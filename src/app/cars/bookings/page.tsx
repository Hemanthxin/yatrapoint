import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { BackButton } from "@/components/app/BackButton";
import { Reveal } from "@/components/app/Reveal";
import { CAR_BOOKING_ENABLED } from "@/lib/cab/flags";
import { userBookings } from "@/lib/cab/core";
import { BookingsList } from "./BookingsList";

export const dynamic = "force-dynamic";

export default async function MyCarBookingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!CAR_BOOKING_ENABLED) redirect("/dashboard");
  const u = session.user;

  const bookings = await userBookings(u.id!);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <Reveal className="mx-auto max-w-2xl">
        <BackButton fallback="/cars" />
        <header className="mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
            <ClipboardList className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">My car bookings</h1>
            <p className="text-sm font-medium text-slate-500">Updates live as your driver responds.</p>
          </div>
        </header>
        <BookingsList bookings={JSON.parse(JSON.stringify(bookings))} />
      </Reveal>
    </AppShell>
  );
}
