export function initialsOf(name?: string | null) {
  if (!name) return "FK";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "FK";
}
