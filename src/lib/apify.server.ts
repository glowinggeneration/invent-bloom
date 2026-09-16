/**
 * Server-only Apify service. Calls are routed through the Lovable connector
 * gateway, so the provider credential never lives in this codebase.
 */

export const APIFY_GATEWAY_URL = "https://connector-gateway.lovable.dev/apify";

/** Headers required by the connector gateway for every Apify request. */
export function getApifyHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  const connectionKey = process.env["APIFY_API_KEY"];
  if (!connectionKey) throw new Error("APIFY_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
}

/** Makes a real authenticated request to Apify to verify the connection. */
export async function checkApifyConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${APIFY_GATEWAY_URL}/users/me`, {
      headers: getApifyHeaders(),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Apify verification failed [${response.status}]: ${body}`);
      return { connected: false, message: "Apify connection failed" };
    }
    await response.json();
    return { connected: true, message: "Apify connected successfully" };
  } catch (error) {
    console.error("Apify verification error", error);
    return { connected: false, message: "Apify connection failed" };
  }
}
