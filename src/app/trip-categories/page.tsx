import { redirect } from "next/navigation";

// "Trips by Places" has been folded into the State / Destinations page, where
// the same categories are available as quick-filter chips. Keep this route as a
// permanent redirect so old links and bookmarks still work.
export default function TripCategoriesPage() {
  redirect("/destinations");
}
