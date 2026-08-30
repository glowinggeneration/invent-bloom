import { ApifyClient } from "apify-client";

/**
 * Server-only Apify service. The token is read from the backend environment
 * and never leaves this module.
 */
export function getApifyToken(): string {
  const token = process.env["APIFY_API_TOKEN"];
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  return token;
}

export function getApifyClient(): ApifyClient {
  return new ApifyClient({ token: getApifyToken() });
}

/** Makes a real authenticated request to Apify to verify the token. */
export async function checkApifyConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  try {
    const token = getApifyToken();
    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error(`Apify verification failed [${response.status}]`);
      return { connected: false, message: "Apify connection failed" };
    }
    await response.json();
    return { connected: true, message: "Apify connected successfully" };
  } catch (error) {
    console.error("Apify verification error", error);
    return { connected: false, message: "Apify connection failed" };
  }
}
