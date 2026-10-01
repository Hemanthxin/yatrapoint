"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { FollowButton } from "./FollowButton";

export function ProfileHeader({
  targetUserId,
  name,
  username,
  image,
  bio,
  postsCount,
  initialFollowerCount,
  followingCount,
  initialFollowing,
}: {
  targetUserId: string;
  name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  postsCount: number;
  initialFollowerCount: number;
  followingCount: number;
  initialFollowing: boolean;
}) {
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);

  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="h-24 w-24 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--border)] sm:h-28 sm:w-28"
        />
      ) : (
        <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-emerald-600 text-3xl font-bold text-white sm:h-28 sm:w-28">
          {name.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          <h1 className="text-xl font-extrabold tracking-tight text-[color:var(--text)]">{name}</h1>
          <FollowButton
            targetUserId={targetUserId}
            initialFollowing={initialFollowing}
            onCountChange={setFollowerCount}
          />
          <Link href={`/community/messages/${targetUserId}`} className="btn-secondary min-h-[44px] px-4 py-2 text-sm">
            <MessageCircle className="h-4 w-4" /> Message
          </Link>
        </div>
        {username && <p className="mt-0.5 text-sm text-[color:var(--muted)]">@{username}</p>}

        <div className="mt-4 flex justify-center gap-6 sm:justify-start">
          <Stat value={postsCount} label="Posts" />
          <Stat value={followerCount} label="Followers" />
          <Stat value={followingCount} label="Following" />
        </div>

        {bio && (
          <p className="mt-4 flex items-start justify-center gap-1.5 text-sm text-[color:var(--text-soft)] sm:justify-start">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {bio}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-lg font-extrabold text-[color:var(--text)]">{value.toLocaleString("en-IN")}</p>
      <p className="text-xs font-medium text-[color:var(--muted)]">{label}</p>
    </div>
  );
}
