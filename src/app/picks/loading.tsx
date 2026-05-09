import { Skeleton } from "@/components/Skeleton";
import { PickSkeleton } from "@/components/picks/PickSkeleton";

export default function PicksLoading() {
  return (
    <main
      role="status"
      aria-label="Loading picks"
      aria-busy="true"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10"
    >
      <header className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </header>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-12" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-12" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PickSkeleton />
        <PickSkeleton />
        <PickSkeleton />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-36 rounded-md" />
      </div>
    </main>
  );
}
