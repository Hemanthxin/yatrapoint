// Admin gate. Set ADMIN_EMAILS in .env.local to a comma-separated list of the
// email addresses allowed to verify community submissions, e.g.
//   ADMIN_EMAILS="you@example.com,teammate@example.com"
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
