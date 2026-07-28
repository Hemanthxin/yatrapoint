import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listConversations } from "@/lib/queries/messages";
import { MessagesInbox } from "./MessagesInbox";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const conversations = await listConversations(session.user.id);

  return <MessagesInbox conversations={conversations} />;
}
