import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/user/session";
import { getPicks } from "@/lib/recommender/engine";
import { PicksClient } from "@/components/picks/PicksClient";
import { PicksFilters } from "@/components/picks/PicksFilters";
import {
  parseMood,
  parseTimeBudget,
} from "@/lib/recommender/filters";
import { ACTIVE_REGION_COPY, type RegionCode } from "@/lib/regions";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ mood?: string; time?: string }>;
}

export default async function PicksPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const params = await searchParams;
  const mood = parseMood(params.mood);
  const time = parseTimeBudget(params.time);

  const region = user.region as RegionCode;
  const result = await getPicks(user, { mood, time });
  const sessionId = randomUUID();

  if (
    result.reason === "needs_more_titles" ||
    result.reason === "no_platforms"
  ) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Next Watch
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Not quite ready yet.
        </h1>
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Link
          href="/"
          className="inline-flex h-8 w-fit items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          Back to onboarding
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Next Watch · 3 picks
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Here&apos;s what to watch next.
        </h1>
        <p className="text-sm text-muted-foreground">{ACTIVE_REGION_COPY}</p>
      </header>

      <PicksFilters mood={mood} time={time} />

      {result.message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {result.message}
        </div>
      )}

      <PicksClient
        initialSlate={result.slate}
        initialQueue={result.queue}
        region={region}
        sessionId={sessionId}
      />

      <footer className="flex items-center justify-between text-xs text-muted-foreground">
        <Link href="/" className="underline-offset-2 hover:underline">
          Edit your watches and platforms
        </Link>
        <span>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB. Streaming availability via TMDB / JustWatch.
        </span>
      </footer>
    </main>
  );
}
