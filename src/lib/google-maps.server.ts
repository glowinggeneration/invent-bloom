/**
 * Google Maps Platform lookups through the Lovable connector gateway.
 * Profile "locations" on X are free text ("Nairobi ke", "254", "Kisumu 🇰🇪"),
 * so we ask Google to turn them into a real place name we can count.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type GeocodeInfo = {
  place: string | null;
  lat: number | null;
  lng: number | null;
  countryCode: string | null;
};

type GoogleAddressComponent = {
  types?: string[];
  long_name?: string;
  short_name?: string;
};

type GoogleGeocodeResult = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
  error_message?: string;
};

/**
 * Reduces a geocode result to a clean place name plus the coordinates and
 * ISO 3166-1 alpha-2 country code Google's response already carries (used to
 * plot a dotted-map marker and a country-flag chip alongside the name).
 */
function toLocationInfo(result: GoogleGeocodeResult | undefined): GeocodeInfo {
  const parts: GoogleAddressComponent[] = Array.isArray(result?.address_components)
    ? result.address_components
    : [];
  const pick = (type: string, key: "long_name" | "short_name" = "long_name") =>
    parts.find((c) => Array.isArray(c.types) && c.types.includes(type))?.[key];
  const city =
    pick("locality") || pick("administrative_area_level_2") || pick("administrative_area_level_1");
  const country = pick("country");
  const countryCode = pick("country", "short_name")?.toUpperCase() || null;

  let place: string | null;
  if (city && country) place = `${city}, ${country}`;
  else if (country) place = country;
  else {
    const formatted = typeof result?.formatted_address === "string" ? result.formatted_address : "";
    place = formatted || null;
  }

  const lat = result?.geometry?.location?.lat;
  const lng = result?.geometry?.location?.lng;

  return {
    place,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    countryCode,
  };
}

/** Geocodes one free-text location. Returns nulls when Google can't place it. */
export async function geocodePlace(value: string): Promise<{
  place: string | null;
  lat: number | null;
  lng: number | null;
  countryCode: string | null;
  error: string | null;
}> {
  const address = value.trim().slice(0, 120);
  if (!address) return { place: null, lat: null, lng: null, countryCode: null, error: null };

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    return {
      place: null,
      lat: null,
      lng: null,
      countryCode: null,
      error: "Google Maps is not connected.",
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
        },
      },
    );
  } catch (e) {
    return { place: null, lat: null, lng: null, countryCode: null, error: (e as Error).message };
  }

  const body = await res.text();
  if (!res.ok) {
    console.error(`Google Maps geocode failed [${res.status}]: ${body}`);
    return {
      place: null,
      lat: null,
      lng: null,
      countryCode: null,
      error: `Google Maps request failed (${res.status}).`,
    };
  }

  let json: GoogleGeocodeResponse | null = null;
  try {
    json = body ? (JSON.parse(body) as GoogleGeocodeResponse) : null;
  } catch {
    return {
      place: null,
      lat: null,
      lng: null,
      countryCode: null,
      error: "Google Maps returned an unreadable response.",
    };
  }

  const status = String(json?.status ?? "");
  if (status !== "OK") {
    if (status === "ZERO_RESULTS")
      return { place: null, lat: null, lng: null, countryCode: null, error: null };
    return {
      place: null,
      lat: null,
      lng: null,
      countryCode: null,
      error: json?.error_message ?? `Google Maps: ${status}`,
    };
  }

  return { ...toLocationInfo(json?.results?.[0]), error: null };
}
