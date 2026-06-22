import Link from "next/link";
import { redirect } from "next/navigation";
import { Plane } from "lucide-react";

import { auth } from "@/auth";
import { AdminLoginCard } from "@/components/AdminLoginCard";
import { isAdminSession } from "@/lib/admin";

export default async function AdminLoginPage() {
  const session = await auth();
  if (isAdminSession(session?.user)) redirect("/admin/dashboard");

  return (
    <main className="relative min-h-screen bg-slate-100 lg:grid lg:grid-cols-[45%_55%]">
      {/* Left — travel panel with curved edge */}
      <div
        className="relative hidden overflow-hidden lg:block lg:[clip-path:ellipse(125%_100%_at_0%_50%)]"
        style={{
          backgroundImage: "url('/admin-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700/70 via-blue-600/45 to-sky-400/40" />

        {/* Plane doodle */}
        <div className="absolute left-10 top-16 text-white/90">
          <svg width="220" height="90" viewBox="0 0 220 90" fill="none">
            <path
              d="M10 80 C 40 80, 40 30, 80 30 S 150 50, 200 12"
              stroke="white"
              strokeWidth="2"
              strokeDasharray="4 6"
              strokeLinecap="round"
              opacity="0.8"
            />
            <circle cx="10" cy="80" r="4" fill="white" />
          </svg>
          <Plane className="absolute right-0 top-0 h-9 w-9 -rotate-12 fill-white text-white" />
        </div>

        <div className="absolute inset-0 flex flex-col justify-center px-12 xl:px-16">
          <h1 className="text-5xl font-extrabold leading-tight text-white xl:text-6xl">
            Travel
            <br />
            The World
          </h1>
          <p className="mt-4 font-script text-3xl text-sky-100">
            Discover. Dream. Explore.
          </p>
          <span className="mt-3 block h-1 w-28 rounded-full bg-sky-200/80" />
        </div>
      </div>

      {/* Right — login card */}
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <Link
          href="/"
          className="absolute right-6 top-6 text-sm font-semibold text-slate-500 hover:text-blue-700"
        >
          User login →
        </Link>
        <AdminLoginCard />
      </div>
    </main>
  );
}
