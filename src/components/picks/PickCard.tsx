"use client";

import { useTransition } from "react";
import { posterUrl } from "@/lib/tmdb/images";
import { providersForRegion } from "@/lib/providers";
import type { RegionCode } from "@/lib/regions";
import type { Pick } from "@/lib/recommender/types";

const BUCKET_LABEL: Record<Pick["bucket"], string> = {
  safe: "Safe Pick",
  stretch: "Stretch Pick",
  gem: "Hidden Gem",
};

const BUCKET_TONE: Record<Pick["bucket"], string> = {
  safe: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  stretch: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  gem: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
};

export type FeedbackAction =
  | "interested"
  | "watchlist"
  | "not_for_me"
  | "already_seen";

interface Props {
  pick: Pick;
  region: RegionCode;
  onAction: (pick: Pick, action: FeedbackAction) => Promise<void>;
}

export function PickCard({ pick, region, onAction }: Props) {
  const [pending, startTransition] = useTransition();
  const poster = posterUrl(pick.posterPath, "w342");

  const providersInRegion = providersForRegion(region);
  const providerNames = pick.providerIds
    .map((id) => providersInRegion.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  function handle(action: FeedbackAction) {
    startTransition(async () => {
      await onAction(pick, action);
    });
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            className="aspect-[2/3] w-full object-cover"
          />
        ) : (
          <div className="aspect-[2/3] w-full bg-muted" />
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${BUCKET_TONE[pick.bucket]}`}
        >
          {BUCKET_LABEL[pick.bucket]}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-foreground/90 px-2 py-1 text-[11px] font-semibold text-background">
          {pick.confidence}% match
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <header className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold leading-tight">
            {pick.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {pick.year ?? "—"} · {pick.mediaType === "movie" ? "Movie" : "TV"}
          </p>
        </header>

        <p className="text-sm text-foreground/90">{pick.reason}</p>

        <div className="mt-auto flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Available on
            </p>
            <p className="text-sm">
              {providerNames.length > 0 ? providerNames.join(" · ") : "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => handle("interested")}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:border-foreground/40 disabled:opacity-50"
            >
              Interested
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handle("watchlist")}
              className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              Add to watchlist
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handle("not_for_me")}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:border-foreground/40 disabled:opacity-50"
            >
              Not for me
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handle("already_seen")}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:border-foreground/40 disabled:opacity-50"
            >
              Already seen
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
