// Versions of the legal documents a user consents to. Bump a version when the
// document changes in a way that needs fresh consent: everyone is asked again
// (see ConsentGate) and the new version is stored next to their agreement.
export const PRIVACY_VERSION = "2026-10-26";
export const TERMS_VERSION = "2026-10-26";

export const CONSENT_KINDS = ["privacy", "terms", "location"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CURRENT_VERSION: Record<ConsentKind, string> = {
  privacy: PRIVACY_VERSION,
  terms: TERMS_VERSION,
  location: "1",
};

export const POLICY_UPDATED_LABEL = "26 October 2026";
