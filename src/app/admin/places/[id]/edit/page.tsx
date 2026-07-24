import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminSession } from "@/lib/admin";
import { getAdminPlace } from "@/lib/queries/admin";
import { PlaceForm, type PlaceFormState } from "@/app/admin/PlaceForm";
import { BackButton } from "@/components/app/BackButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlacePage({ params }: PageProps) {
  const session = await auth();
  if (!session || !isAdminSession(session.user)) redirect("/admin-login");
  const { id } = await params;

  const place = await getAdminPlace(id);
  if (!place) notFound();

  const u = session.user;
  const initial: Partial<PlaceFormState> = {
    name: place.name,
    state: place.state,
    district: place.district ?? "",
    category: place.category,
    placeType: place.placeType ?? "Sightseeing",
    description: place.description,
    shortDescription: place.shortDescription,
    openingTimings: place.openingTimings ?? "",
    entryFees: String(place.entryFees ?? 0),
    entryFeesForeigner: place.entryFeesForeigner != null ? String(place.entryFeesForeigner) : "",
    entryFeesChild: place.entryFeesChild != null ? String(place.entryFeesChild) : "",
    bookingUrl: place.bookingUrl ?? "",
    visitorGuidelines: place.visitorGuidelines ?? "",
    budgetPerDay: String(place.budgetPerDay ?? 0),
    recommendedDays: String(place.recommendedDays ?? 1),
    bestMonths: place.bestMonths ?? "",
    latitude: place.latitude ?? "",
    longitude: place.longitude ?? "",
    popularity: String(place.popularity ?? 50),
    isHidden: place.isHidden,
  };

  return (
    <AdminShell adminName={u.name || u.email || "Admin"} adminEmail={u.email}>
      <BackButton fallback="/admin/places" label="Back to Places" />
      <div className="mx-auto max-w-3xl">
        <PlaceForm
          mode="edit"
          placeId={place.id}
          initial={initial}
          initialPhoto={place.imageUrl}
          redirectTo="/admin/places"
        />
      </div>
    </AdminShell>
  );
}
