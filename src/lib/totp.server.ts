/**
 * RFC 6238 TOTP generation (SHA-1, 6 digits, 30s step) using Web Crypto.
 * Lets us derive the live 6-digit code from a stored base32 secret without
 * any third-party code-generator website.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function normalizeBase32(secret: string): string {
  return secret.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
}

export function isValidBase32Secret(secret: string): boolean {
  const s = normalizeBase32(secret);
  return s.length >= 16 && /^[A-Z2-7]+$/.test(s);
}

function base32Decode(secret: string): Uint8Array {
  const s = normalizeBase32(secret);
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character in 2FA secret.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Generate the current 6-digit TOTP code for a base32 secret. */
export async function generateTotp(
  secret: string,
  atMs: number = Date.now(),
  stepSeconds = 30,
  digits = 6,
): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(atMs / 1000 / stepSeconds);

  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, msg as unknown as ArrayBuffer),
  );
  const offset = sig[sig.length - 1]! & 0x0f;
  const bin =
    ((sig[offset]! & 0x7f) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}
