import Link from "next/link";

interface NavProps {
  actionLabel?: string;
  actionHref?: string;
}

// No brand mark here — the Hero already carries the logo on this screen, and
// repeating it in the corner too was visual clutter. Just the admin link.
export function Nav({
  actionLabel = "Admin",
  actionHref = "/admin-login",
}: NavProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-end px-5 py-5 md:px-6">
      <Link
        href={actionHref}
        className="rounded-full border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-white/25"
      >
        {actionLabel}
      </Link>
    </header>
  );
}
