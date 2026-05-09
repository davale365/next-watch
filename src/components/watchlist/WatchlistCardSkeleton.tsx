import { Skeleton } from "@/components/Skeleton";

export function WatchlistCardSkeleton() {
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <Skeleton className="aspect-[2/3] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1">
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <Skeleton className="h-7" />
          <Skeleton className="h-7" />
        </div>
      </div>
    </li>
  );
}
