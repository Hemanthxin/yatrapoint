// Admin identities used for the dedicated admin login.
// Password is intentionally shared across the fixed admin accounts because the
// product requirement calls for one common admin password.
export const ADMIN_ACCOUNTS = [
  { email: "hemanth@admin.com", name: "Hemanth" },
  { email: "sunil@admin.com", name: "Sunil" },
  { email: "loki@admin.com", name: "Loki" },
  { email: "subu@admin.com", name: "Subu" },
  { email: "suhas@admin.com", name: "Suhas" },
] as const;

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@321";

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function adminEmails(): string[] {
  return ADMIN_ACCOUNTS.map((a) => a.email);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(normalizeEmail(email));
}

export function isAdminSession(
  user?: { email?: string | null; role?: string | null } | null
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return isAdminEmail(user.email);
}

export function validateAdminCredentials(email?: string | null, password?: string | null): boolean {
  return isAdminEmail(email) && password === ADMIN_PASSWORD;
}

export function adminDisplayName(email?: string | null): string {
  const normalized = normalizeEmail(email);
  const match = ADMIN_ACCOUNTS.find((a) => a.email === normalized);
  return match?.name ?? "Admin";
}
