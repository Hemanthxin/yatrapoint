import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoPage } from "@/components/app/InfoPage";
import { TermsOfServiceContent } from "@/components/legal/TermsOfServiceContent";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Review the terms for using Saafera to plan and discover travel experiences in India.",
  alternates: {
    canonical: "/terms",
  },
};

export default async function TermsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <InfoPage
        icon={FileText}
        title="Terms of Service"
        subtitle="The rules for using Saafera."
        updated="13 July 2026"
      >
        <TermsOfServiceContent />
      </InfoPage>
    </AppShell>
  );
}
