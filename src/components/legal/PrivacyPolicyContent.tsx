import { InfoList, InfoSection } from "@/components/app/InfoPage";

// Shared with both the full authenticated /privacy page and the login-page
// popup — keeps the two from drifting out of sync.
export function PrivacyPolicyContent() {
  return (
    <>
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
            "You can turn location off in Settings → Privacy & consent, or revoke the permission in your browser or device settings.",
            "You can permanently delete your account and all associated data at any time from Settings → Danger Zone.",
          ]}
        />
      </InfoSection>

      <InfoSection title="Your consent">
        <InfoList
          items={[
            "We use your personal data only with your consent, which you give by ticking the Privacy Policy box when you sign up or when we ask you to review it.",
            "We keep a record of when you agreed and which version of this policy you agreed to.",
            "You can withdraw your consent for location at any time in Settings → Privacy & consent. Withdrawing your agreement to this policy altogether means we can no longer provide the service, so you would delete your account from Settings → Danger Zone.",
            "Withdrawing consent does not affect what we did with your data before you withdrew it.",
          ]}
        />
      </InfoSection>

      <InfoSection title="Children">
        <p>
          Saafera is intended for people aged 18 and over. It is not meant for anyone under 18,
          and we do not knowingly collect personal data from children. If you believe a child
          has given us their details, please email us and we will delete them.
        </p>
      </InfoSection>

      <InfoSection title="Changes to this policy">
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date above shows
          the current version. When we make a material change, we will ask you to review and
          agree to the new version before you continue using the app.
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
    </>
  );
}
