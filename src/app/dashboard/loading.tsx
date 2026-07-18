import { SkeletonShell, DashboardSkeleton } from "@/components/app/skeletons/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <DashboardSkeleton />
    </SkeletonShell>
  );
}
