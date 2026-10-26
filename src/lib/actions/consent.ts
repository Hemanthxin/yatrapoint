"use server";

import { auth } from "@/auth";
import { hasRequiredConsents, latestConsents, recordConsents } from "@/lib/consent";

// Fixed admin logins have no row in `users` (their id is "admin:<email>"), so
// consent does not apply to them.
const isAdminId = (id: string) => id.startsWith("admin:");

export interface MyConsent {
  signedIn: boolean;
  needsConsent: boolean;
  locationAllowed: boolean;
  privacy?: { version: string; at: string };
  terms?: { version: string; at: string };
}

export async function getMyConsentStatus(): Promise<MyConsent> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return { signedIn: false, needsConsent: false, locationAllowed: true };
  if (isAdminId(id)) return { signedIn: true, needsConsent: false, locationAllowed: true };

  try {
    const c = await latestConsents(id);
    return {
      signedIn: true,
      needsConsent: !hasRequiredConsents(c),
      // No record means the browser's own prompt is the only gate; only an explicit withdrawal blocks location.
      locationAllowed: !(c.location && !c.location.granted),
      privacy: c.privacy?.granted ? { version: c.privacy.version, at: c.privacy.at.toISOString() } : undefined,
      terms: c.terms?.granted ? { version: c.terms.version, at: c.terms.at.toISOString() } : undefined,
    };
  } catch (err) {
    // Never lock people out of the app because the consent table had a hiccup.
    console.error("[getMyConsentStatus] failed:", err);
    return { signedIn: true, needsConsent: false, locationAllowed: true };
  }
}

// For people who signed in (e.g. with Google) or were signed up before consent was recorded.
export async function acceptRequiredConsents(input: { privacy: boolean; terms: boolean }) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || isAdminId(id)) return { ok: false as const, error: "Please sign in." };
  if (!input.privacy || !input.terms) return { ok: false as const, error: "Please accept both the Privacy Policy and the Terms of Service." };
  try {
    await recordConsents(id, [
      { kind: "privacy", granted: true },
      { kind: "terms", granted: true },
    ]);
    return { ok: true as const };
  } catch (err) {
    console.error("[acceptRequiredConsents] failed:", err);
    return { ok: false as const, error: "Could not save your choice. Please try again." };
  }
}

export async function setLocationConsent(granted: boolean) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || isAdminId(id)) return { ok: false as const, error: "Please sign in." };
  try {
    await recordConsents(id, [{ kind: "location", granted }]);
    return { ok: true as const };
  } catch (err) {
    console.error("[setLocationConsent] failed:", err);
    return { ok: false as const, error: "Could not save your choice." };
  }
}
