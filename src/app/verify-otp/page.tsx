import { redirect } from "next/navigation";
import { BackgroundScene } from "@/components/BackgroundScene";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { OtpCard } from "@/components/OtpCard";
import { TrustStrip } from "@/components/TrustStrip";
import { phoneSchema } from "@/lib/validators";

interface PageProps {
  searchParams: Promise<{ phone?: string }>;
}

export default async function VerifyOtpPage({ searchParams }: PageProps) {
  const { phone } = await searchParams;
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) redirect("/");

  // Default UI expiry display: server already set 180s when OTP was sent.
  const expirySeconds = Number(process.env.OTP_EXPIRY_SECONDS ?? 180);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundScene />
      <Nav />

      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 pb-12 pt-32 md:px-12 lg:flex-row lg:items-center lg:justify-between lg:pt-36">
        <Hero />
        <div className="w-full lg:w-auto">
          <OtpCard phone={parsed.data} initialExpiresInSeconds={expirySeconds} />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 md:px-12">
        <TrustStrip />
      </section>
    </main>
  );
}
