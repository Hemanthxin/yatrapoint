import { SkeletonShell, PanelSkeleton } from "@/components/app/skeletons/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <PanelSkeleton panels={3} />
    </SkeletonShell>
  );
}
