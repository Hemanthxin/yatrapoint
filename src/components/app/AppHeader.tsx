import Link from "next/link";
import { signOut } from "@/auth";
import { Logo } from "@/components/Logo";
import { NavLink } from "./NavLink";

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/one-day-trips", label: "One-Day Trips" },
  { href: "/destinations", label: "Destinations" },
  { href: "/budget-planner", label: "Budget" },
];

interface AppHeaderProps {
  userLabel: string;
  userImage?: string | null;
}

export function AppHeader({ userLabel, userImage }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
        <Link href="/dashboard" className="text-slate-900" aria-label="Home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                {userLabel.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden max-w-[8rem] truncate sm:inline">
              {userLabel}
            </span>
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Log Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
