import { auth } from "@/auth";
import { getPlaceReviews } from "@/lib/queries/reviews";
import { isAdminSession } from "@/lib/admin";
import { ReviewsPanel } from "./ReviewsPanel";

interface Props {
  placeId: string;
  placeName: string;
  className?: string;
}

// Reviews for one place — readable by every signed-in visitor, writable by
// them too (one review each, editable and deletable by its author). Drop it on
// any place page; it only needs the place's id.
export async function PlaceReviews({ placeId, placeName, className }: Props) {
  const [session, data] = await Promise.all([
    auth(),
    getPlaceReviews(placeId).catch((err) => {
      console.error("[reviews] could not load", err);
      return null;
    }),
  ]);
  if (!data) return null;
  const user = session?.user;
  return (
    <ReviewsPanel
      placeId={placeId}
      placeName={placeName}
      initial={data}
      viewerId={user?.id ?? null}
      isAdmin={isAdminSession(user as { email?: string | null; role?: string | null } | undefined)}
      className={className}
    />
  );
}
