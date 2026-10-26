import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoPage } from "@/components/app/InfoPage";
import { PublicInfoShell } from "@/components/app/PublicInfoShell";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";
import { POLICY_UPDATED_LABEL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read how Saafera handles your data, account information, and privacy preferences.",
  alternates: {
    canonical: "/privacy",
  },
};

// Public on purpose: people must be able to read this before they have an
// account, and Google Play links to it.
export default async function PrivacyPage() {
  const session = await auth();
  const u = session?.user;

  const page = (
    <InfoPage
      icon={Lock}
      title="Privacy Policy"
      subtitle="How Saafera collects, uses and protects your information."
      updated={POLICY_UPDATED_LABEL}
      backFallback={u ? "/settings" : "/"}
    >
      <PrivacyPolicyContent />
    </InfoPage>
  );

  if (!u) return <PublicInfoShell>{page}</PublicInfoShell>;
  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {page}
    </AppShell>
  );
}
