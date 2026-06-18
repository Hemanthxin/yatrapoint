import Link from "next/link";
import { Instagram, Twitter, Facebook } from "lucide-react";

export function LandingFooter() {
  const year = 2026;
  return (
    <footer className="relative z-10 border-t border-white/15 px-6 py-6 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 text-sm text-white/80 md:flex-row md:justify-between">
        {/* Left corner */}
        <p className="order-2 md:order-1">© {year} Explore World</p>

        {/* Center */}
        <nav className="order-1 flex items-center gap-6 md:order-2">
          <Link href="#login" className="transition hover:text-white">
            Login
          </Link>
          <a href="#" className="transition hover:text-white">
            Privacy
          </a>
          <a href="#" className="transition hover:text-white">
            Terms
          </a>
          <a href="mailto:hello@exploreworld.app" className="transition hover:text-white">
            Contact
          </a>
        </nav>

        {/* Right corner */}
        <div className="order-3 flex items-center gap-4">
          <a href="#" aria-label="Instagram" className="text-white/70 transition hover:text-white">
            <Instagram className="h-5 w-5" />
          </a>
          <a href="#" aria-label="Twitter" className="text-white/70 transition hover:text-white">
            <Twitter className="h-5 w-5" />
          </a>
          <a href="#" aria-label="Facebook" className="text-white/70 transition hover:text-white">
            <Facebook className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
