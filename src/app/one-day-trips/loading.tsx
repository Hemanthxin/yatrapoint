import { SkeletonShell, ListingSkeleton } from "@/components/app/skeletons/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <ListingSkeleton cards={12} />
    </SkeletonShell>
  );
}
