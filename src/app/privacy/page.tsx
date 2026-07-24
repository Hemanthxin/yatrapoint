import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoPage } from "@/components/app/InfoPage";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read how Saafera handles your data, account information, and privacy preferences.",
  alternates: {
    canonical: "/privacy",
  },
};

export default async function PrivacyPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <InfoPage
        icon={Lock}
        title="Privacy Policy"
        subtitle="How Saafera collects, uses and protects your information."
        updated="13 July 2026"
      >
        <PrivacyPolicyContent />
      </InfoPage>
    </AppShell>
  );
}
