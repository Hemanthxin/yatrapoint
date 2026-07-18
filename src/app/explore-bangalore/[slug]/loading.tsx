import { SkeletonShell, DetailSkeleton } from "@/components/app/skeletons/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <DetailSkeleton />
    </SkeletonShell>
  );
}
