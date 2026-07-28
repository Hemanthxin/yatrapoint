import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPublicProfile } from "@/lib/queries/follows";
import { listThread } from "@/lib/queries/messages";
import { ThreadView } from "./ThreadView";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function ThreadPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const me = session.user;
  const { userId: otherUserId } = await params;

  if (otherUserId === me.id) redirect("/community/messages");

  const profile = await getPublicProfile(otherUserId);
  if (!profile) notFound();

  const thread = await listThread(me.id ?? "", otherUserId);

  return (
    <ThreadView
      otherUserId={otherUserId}
      otherUserName={profile.name || profile.username || "Traveller"}
      otherUserImage={profile.image}
      currentUserId={me.id ?? ""}
      initialMessages={thread}
    />
  );
}
