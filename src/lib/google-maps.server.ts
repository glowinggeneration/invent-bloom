/**
 * Google Maps Platform lookups through the Lovable connector gateway.
 * Profile "locations" on X are free text ("Nairobi ke", "254", "Kisumu 🇰🇪"),
 * so we ask Google to turn them into a real place name we can count.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

/** Reduces a geocode result to "City, Country" (or the best available). */
function toPlaceName(result: any): string | null {
  const parts: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
  const pick = (type: string) =>
    parts.find((c) => Array.isArray(c?.types) && c.types.includes(type))?.long_name as
      string | undefined;
  const city =
    pick("locality") || pick("administrative_area_level_2") || pick("administrative_area_level_1");
  const country = pick("country");
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  const formatted = typeof result?.formatted_address === "string" ? result.formatted_address : "";
  return formatted || null;
}

/** Geocodes one free-text location. Returns null when Google can't place it. */
export async function geocodePlace(
  value: string,
): Promise<{ place: string | null; error: string | null }> {
  const address = value.trim().slice(0, 120);
  if (!address) return { place: null, error: null };

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    return { place: null, error: "Google Maps is not connected." };
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
    return { place: null, error: (e as Error).message };
  }

  const body = await res.text();
  if (!res.ok) {
    console.error(`Google Maps geocode failed [${res.status}]: ${body}`);
    return { place: null, error: `Google Maps request failed (${res.status}).` };
  }

  let json: any = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    return { place: null, error: "Google Maps returned an unreadable response." };
  }

  const status = String(json?.status ?? "");
  if (status !== "OK") {
    if (status === "ZERO_RESULTS") return { place: null, error: null };
    return { place: null, error: json?.error_message ?? `Google Maps: ${status}` };
  }

  return { place: toPlaceName(json?.results?.[0]), error: null };
}
