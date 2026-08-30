export const ADMIN_EMAIL = "ledimothabo@gmail.com";

function normalize(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAdminEmail(email?: string | null): boolean {
  return normalize(email) === ADMIN_EMAIL;
}

/** Throws when the authenticated caller is not the admin account. */
export function assertAdmin(context: { claims?: Record<string, unknown> }): void {
  const email = context.claims?.["email"];
  if (!isAdminEmail(typeof email === "string" ? email : null)) {
    throw new Error("Forbidden: admin only.");
  }
}
