import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listNotifications } from "@/lib/queries/notifications";
import { NotificationsList } from "./NotificationsList";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const notifications = await listNotifications(session.user.id);

  return <NotificationsList notifications={notifications} />;
}
