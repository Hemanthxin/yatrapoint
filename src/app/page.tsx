import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { BackgroundScene } from "@/components/BackgroundScene";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { AuthCard } from "@/components/AuthCard";
import { TrustStrip } from "@/components/TrustStrip";
import { MobileLogin } from "@/components/MobileLogin";

export default async function HomePage() {
  const session = await auth();
  if (isAdminSession(session?.user)) redirect("/admin/dashboard");
  if (session?.user) redirect("/dashboard");

  const googleClientId = process.env.AUTH_GOOGLE_ID;

  return (
    <>
      {/* ── Desktop (≥ lg): the ORIGINAL login, unchanged ── */}
      <main className="relative hidden min-h-screen overflow-hidden lg:block">
        <BackgroundScene />
        <Nav />
        <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 pb-12 pt-32 md:px-12 lg:flex-row lg:items-center lg:justify-between lg:pt-36">
          <Hero />
          <div id="login" className="w-full lg:w-auto">
            <AuthCard googleClientId={googleClientId} />
          </div>
        </section>
        <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 md:px-12">
          <TrustStrip />
        </section>
      </main>

      {/* ── Mobile (< lg): the Saafera brand login ── */}
      <div className="lg:hidden">
        <MobileLogin googleClientId={googleClientId} />
      </div>
    </>
  );
}
