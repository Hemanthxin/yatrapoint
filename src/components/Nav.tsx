import Link from "next/link";
import { Logo } from "./Logo";

export function Nav() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-6">
      {/* Logo pinned to the top-left corner of the screen */}
      <Link href="/" aria-label="Explore World home">
        <Logo />
      </Link>
    </header>
  );
}
