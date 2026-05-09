import { Skeleton } from "@/components/Skeleton";
import { WatchlistCardSkeleton } from "@/components/watchlist/WatchlistCardSkeleton";

export default function WatchlistLoading() {
  return (
    <main
      role="status"
      aria-label="Loading watchlist"
      aria-busy="true"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10"
    >
      <header className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-32" />
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <WatchlistCardSkeleton />
        <WatchlistCardSkeleton />
        <WatchlistCardSkeleton />
        <WatchlistCardSkeleton />
      </ul>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
    </main>
  );
}
