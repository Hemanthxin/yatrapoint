import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLoginCard } from "@/components/AdminLoginCard";
import { isAdminSession } from "@/lib/admin";

export default async function AdminLoginPage() {
  const session = await auth();
  if (isAdminSession(session?.user)) redirect("/admin/dashboard");

  return (
    <main
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/admin-bg.jpg')" }}
    >
      <Link
        href="/"
        className="absolute right-6 top-6 z-10 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
      >
        User login →
      </Link>

      {/* Card centered */}
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <AdminLoginCard />
      </div>
    </main>
  );
}
