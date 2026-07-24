import { notFound, redirect } from "next/navigation";
import { getLongTripBySlug } from "@/lib/queries/long-trips";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// A history entry only stores the trip's slug (unique across all states), so
// this resolves it to the real /budget-planner/long-trips/[state]/[slug] URL.
export default async function OpenHistoryTripPage({ params }: PageProps) {
  const { slug } = await params;
  const trip = await getLongTripBySlug(slug);
  if (!trip) notFound();
  redirect(`/budget-planner/long-trips/${encodeURIComponent(trip.state)}/${trip.slug}`);
}
