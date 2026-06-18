import Link from "next/link";
import { Logo } from "./Logo";

export function Nav({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 px-6 py-5 md:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Left corner */}
        <Link href="/" aria-label="Explore World home">
          <Logo />
        </Link>
        {/* Right corner */}
        <div className="flex items-center gap-3">{rightSlot}</div>
      </div>
    </header>
  );
}
