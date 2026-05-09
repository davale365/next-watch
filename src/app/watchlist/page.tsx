import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user/session";
import { listWatchlistForUser } from "@/lib/watchlist/list";
import {
  WatchlistGrid,
  type SerializedEntry,
} from "@/components/watchlist/WatchlistGrid";
import { type RegionCode } from "@/lib/regions";

export const dynamic = "force-dynamic";

const ADDED_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const region = user.region as RegionCode;
  const entries = await listWatchlistForUser({
    userId: user.id,
    region,
    selectedPlatforms: user.selectedPlatforms,
  });

  const initialEntries: SerializedEntry[] = entries.map((e) => ({
    title: e.title,
    addedAtIso: e.addedAt.toISOString(),
    addedAtLabel: `Added ${ADDED_DATE_FORMAT.format(e.addedAt)}`,
    providerIds: e.providerIds,
  }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your watchlist
        </h1>
      </header>

      <WatchlistGrid initialEntries={initialEntries} region={region} />

      <footer className="flex items-center justify-between text-xs text-muted-foreground">
        <Link href="/picks" className="underline-offset-2 hover:underline">
          Back to picks
        </Link>
        <Link href="/" className="underline-offset-2 hover:underline">
          Edit your watches and platforms
        </Link>
      </footer>
    </main>
  );
}
