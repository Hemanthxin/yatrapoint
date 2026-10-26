import Link from "next/link";
import Image from "next/image";

// A plain page frame for the legal pages when nobody is signed in — they must
// be readable before anyone has an account (and Google Play links to them).
// Signed-in visitors still get the normal app shell around the same content.
export function PublicInfoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Saafera home">
            <Image src="/saafera-logo.jpg" alt="" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-extrabold tracking-tight text-slate-900">Saafera</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-600">
            <Link href="/privacy" className="hover:text-emerald-700">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-700">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="px-4 py-6">{children}</main>
    </div>
  );
}
