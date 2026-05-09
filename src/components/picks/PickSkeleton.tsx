import { Skeleton } from "@/components/Skeleton";

export function PickSkeleton() {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative">
        <Skeleton className="aspect-[2/3] w-full rounded-none" />
        <Skeleton className="absolute left-3 top-3 h-5 w-20 rounded-full" />
        <Skeleton className="absolute right-3 top-3 h-5 w-20 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
            <Skeleton className="h-7" />
          </div>
        </div>
      </div>
    </article>
  );
}
