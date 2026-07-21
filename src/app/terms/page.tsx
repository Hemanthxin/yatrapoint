import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoList, InfoPage, InfoSection } from "@/components/app/InfoPage";

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
        <InfoSection title="1. Acceptance of terms">
          <p>
            By creating an account or using Saafera (the &quot;Service&quot;), you agree to these Terms
            of Service. If you do not agree, please do not use the Service.
          </p>
        </InfoSection>

        <InfoSection title="2. Using the Service">
          <InfoList
            items={[
              "You must provide accurate account information and keep it up to date.",
              "You are responsible for activity that happens under your account.",
              "You agree not to misuse the Service, disrupt it, attempt unauthorised access, or use it for any unlawful purpose.",
              "You must be able to form a binding contract in your jurisdiction to use the Service.",
            ]}
          />
        </InfoSection>

        <InfoSection title="3. Your content">
          <p>
            You keep ownership of the content you post (such as community posts, photos and
            descriptions). By posting, you grant Saafera a non-exclusive licence to display
            that content within the app so other users can see it. You are responsible for
            what you post and must have the right to share it. Don't post content that is
            illegal, infringing, misleading, offensive, or that violates others' privacy.
          </p>
          <p>
            We may remove content that violates these terms or that we reasonably believe is
            harmful, without notice.
          </p>
        </InfoSection>

        <InfoSection title="4. Travel information is indicative">
          <p>
            Saafera provides estimates and aggregated information to help you plan — including
            budgets, entry fees, timings, distances, routes, fares and weather. This
            information comes from curated data and third-party sources and{" "}
            <strong>may be inaccurate, incomplete or out of date</strong>. Always reconfirm
            important details directly with the relevant provider before you travel or spend
            money. Saafera is a planning aid, not a booking service or a guarantee of price
            or availability.
          </p>
        </InfoSection>

        <InfoSection title="5. Third-party services & links">
          <p>
            The Service uses and links to third-party services (such as Google Maps,
            OpenStreetMap, Wikipedia and weather providers). We don't control those services
            and aren't responsible for their content, availability or practices. Your use of
            them is subject to their own terms.
          </p>
        </InfoSection>

        <InfoSection title="6. Disclaimers">
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any
            kind, whether express or implied, including fitness for a particular purpose and
            accuracy of information. We do not warrant that the Service will be uninterrupted,
            error-free or secure.
          </p>
        </InfoSection>

        <InfoSection title="7. Limitation of liability">
          <p>
            To the maximum extent permitted by law, Saafera and its team will not be liable
            for any indirect, incidental, or consequential damages, or for any loss arising
            from your reliance on information in the app, your travel decisions, or third-party
            services. Your use of the Service is at your own risk.
          </p>
        </InfoSection>

        <InfoSection title="8. Termination">
          <p>
            You may stop using the Service and request account deletion at any time. We may
            suspend or terminate access if you violate these terms or misuse the Service.
          </p>
        </InfoSection>

        <InfoSection title="9. Changes to these terms">
          <p>
            We may update these terms from time to time. Changes are effective when posted,
            shown by the &quot;Last updated&quot; date above. Continuing to use the Service after a
            change means you accept the updated terms.
          </p>
        </InfoSection>

        <InfoSection title="10. Contact">
          <p>
            Questions about these terms? Email{" "}
            <a href="mailto:support@saafera.app" className="font-semibold text-emerald-700 hover:underline">
              support@saafera.app
            </a>
            .
          </p>
        </InfoSection>
      </InfoPage>
    </AppShell>
  );
}
