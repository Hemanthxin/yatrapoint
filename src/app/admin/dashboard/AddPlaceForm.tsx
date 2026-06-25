"use client";

import { PlaceForm } from "@/app/admin/PlaceForm";

// Thin wrapper kept for the dashboard. The real form lives in PlaceForm so add
// and edit share one implementation.
export function AddPlaceForm() {
  return <PlaceForm mode="add" />;
}
