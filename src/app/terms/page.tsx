import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoPage } from "@/components/app/InfoPage";
import { PublicInfoShell } from "@/components/app/PublicInfoShell";
import { TermsOfServiceContent } from "@/components/legal/TermsOfServiceContent";
import { POLICY_UPDATED_LABEL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Review the terms for using Saafera to plan and discover travel experiences in India.",
  alternates: {
    canonical: "/terms",
  },
};

// Public on purpose: people must be able to read this before they have an account.
export default async function TermsPage() {
  const session = await auth();
  const u = session?.user;

  const page = (
    <InfoPage
      icon={FileText}
      title="Terms of Service"
      subtitle="The rules for using Saafera."
      updated={POLICY_UPDATED_LABEL}
      backFallback={u ? "/settings" : "/"}
    >
      <TermsOfServiceContent />
    </InfoPage>
  );

  if (!u) return <PublicInfoShell>{page}</PublicInfoShell>;
  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      {page}
    </AppShell>
  );
}
