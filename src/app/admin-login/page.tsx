import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BackgroundScene } from "@/components/BackgroundScene";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { TrustStrip } from "@/components/TrustStrip";
import { AdminLoginCard } from "@/components/AdminLoginCard";
import { isAdminSession } from "@/lib/admin";

export default async function AdminLoginPage() {
  const session = await auth();
  if (isAdminSession(session?.user)) redirect("/admin/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundScene />
      <Nav actionLabel="User Login" actionHref="/" />

      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 pb-12 pt-32 md:px-12 lg:flex-row lg:items-center lg:justify-between lg:pt-36">
        <Hero />
        <div id="login" className="w-full lg:w-auto">
          <AdminLoginCard />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 md:px-12">
        <TrustStrip />
      </section>
    </main>
  );
}
