import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BackgroundScene } from "@/components/BackgroundScene";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { LandingFooter } from "@/components/LandingFooter";
import { PhoneLoginCard } from "@/components/PhoneLoginCard";
import { TrustStrip } from "@/components/TrustStrip";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundScene />
      <Nav
        rightSlot={
          <Link
            href="#login"
            className="hidden rounded-lg border border-white/40 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 lg:inline-block"
          >
            Sign Up
          </Link>
        }
      />

      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 pb-12 pt-32 md:px-12 lg:flex-row lg:items-center lg:justify-between lg:pt-36">
        <Hero />
        <div id="login" className="w-full lg:w-auto">
          <PhoneLoginCard googleClientId={process.env.AUTH_GOOGLE_ID} />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 md:px-12">
        <TrustStrip />
      </section>

      <LandingFooter />
    </main>
  );
}
