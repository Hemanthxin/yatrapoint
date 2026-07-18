import { SkeletonShell, SkeletonHeader, SkeletonCardGrid, Skeleton } from "@/components/app/skeletons/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      {/* Profile header card */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-48 rounded-2xl" />
          <Skeleton className="h-4 w-32 rounded-full" />
        </div>
      </div>
      <div className="mt-6">
        <SkeletonHeader />
        <SkeletonCardGrid count={8} />
      </div>
    </SkeletonShell>
  );
}
