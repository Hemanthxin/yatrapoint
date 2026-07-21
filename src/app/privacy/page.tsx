import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoList, InfoPage, InfoSection } from "@/components/app/InfoPage";

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
        <InfoSection title="Overview">
          <p>
            This Privacy Policy explains what information Saafera (&quot;we&quot;, &quot;us&quot;) collects
            when you use the app, how we use it, and the choices you have. We aim to collect
            only what we need to make trip planning work well for you.
          </p>
        </InfoSection>

        <InfoSection title="Information we collect">
          <InfoList
            items={[
              <><strong>Account details</strong> — your name, email address and/or phone number, and profile info (username, bio, photo) when you sign up or edit your profile.</>,
              <><strong>Sign-in data</strong> — if you sign in with Google, we receive basic profile information from Google to create your account.</>,
              <><strong>Your activity</strong> — the trips you plan, places you save or favourite, community posts you create, and items in your trip cart.</>,
              <><strong>Location</strong> — if you grant permission, your device location is used to show nearby places, distances and local weather. You can decline; we then default to a city centre.</>,
              <><strong>Technical data</strong> — basic information needed to operate the service securely (for example, session and authentication tokens).</>,
            ]}
          />
        </InfoSection>

        <InfoSection title="How we use your information">
          <InfoList
            items={[
              "To create and manage your account and keep you signed in.",
              "To build trip plans, show nearby places, distances and live weather.",
              "To save your trips, favourites and preferences across sessions.",
              "To power community features you choose to use.",
              "To keep the service secure and to fix problems.",
            ]}
          />
        </InfoSection>

        <InfoSection title="Third-party services">
          <p>We rely on trusted third-party services to make the app work:</p>
          <InfoList
            items={[
              <><strong>Google</strong> — optional sign-in.</>,
              <><strong>OpenStreetMap / Overpass</strong> — map data, nearby places and routing.</>,
              <><strong>Wikipedia</strong> — place photos.</>,
              <><strong>Open-Meteo &amp; BigDataCloud</strong> — weather, air quality and place-name lookup for your location.</>,
              <><strong>Our database provider</strong> — securely stores your account and trip data.</>,
            ]}
          />
          <p>
            When your browser requests weather or nearby data, your approximate coordinates
            may be sent to those services to return relevant results. We do not sell your
            personal information to anyone.
          </p>
        </InfoSection>

        <InfoSection title="Data sharing">
          <p>
            We don't sell or rent your personal data. Content you choose to post publicly
            (such as community posts, including any photo and location you attach) is visible
            to other users. Everything else in your account is private to you.
          </p>
        </InfoSection>

        <InfoSection title="Data retention & your choices">
          <InfoList
            items={[
              "You can view and update your profile details at any time in Settings.",
              "You can remove favourites, delete trips, and delete community posts you created.",
              "You can revoke location permission in your browser or device settings.",
              "To request deletion of your account and associated data, contact us at the email below.",
            ]}
          />
        </InfoSection>

        <InfoSection title="Children">
          <p>
            Saafera is intended for general audiences and is not directed at children under
            13. We do not knowingly collect personal information from children.
          </p>
        </InfoSection>

        <InfoSection title="Changes to this policy">
          <p>
            We may update this policy from time to time. Material changes will be reflected
            by the &quot;Last updated&quot; date above. Continued use of the app after an update means
            you accept the revised policy.
          </p>
        </InfoSection>

        <InfoSection title="Contact us">
          <p>
            Questions about privacy? Email{" "}
            <a href="mailto:privacy@saafera.app" className="font-semibold text-emerald-700 hover:underline">
              privacy@saafera.app
            </a>
            .
          </p>
        </InfoSection>
      </InfoPage>
    </AppShell>
  );
}
