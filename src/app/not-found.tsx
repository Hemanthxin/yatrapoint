import Link from "next/link";
import { Home } from "lucide-react";
import { PageNotFoundIllustration } from "@/components/illustrations";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--surface)] p-6">
      <div className="animate-fadeUp mx-auto max-w-md text-center">
        <PageNotFoundIllustration className="mx-auto h-64 w-64" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.03] active:scale-95"
        >
          <Home className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
