"use client";

import { useTransition } from "react";
import { posterUrl } from "@/lib/tmdb/images";
import { providersForRegion } from "@/lib/providers";
import {
  markWatchedFromWatchlistAction,
  removeFromWatchlistAction,
} from "@/lib/actions/watchlist";
import type { RegionCode } from "@/lib/regions";
import type { Title } from "@/db/schema";

interface Props {
  title: Title;
  addedAtLabel: string;
  providerIds: number[];
  region: RegionCode;
  onRemoved: (titleId: string) => void;
  onMarkedWatched: (titleId: string) => void;
}

export function WatchlistCard({
  title,
  addedAtLabel,
  providerIds,
  region,
  onRemoved,
  onMarkedWatched,
}: Props) {
  const [pending, startTransition] = useTransition();
  const poster = posterUrl(title.posterPath, "w342");
  const allProviders = providersForRegion(region);
  const providerNames = providerIds
    .map((id) => allProviders.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeFromWatchlistAction({ titleId: title.id });
        onRemoved(title.id);
      } catch {
        // ignore — let parent show stale state until refresh
      }
    });
  }

  function handleMarkWatched() {
    startTransition(async () => {
      try {
        await markWatchedFromWatchlistAction({ titleId: title.id });
        onMarkedWatched(title.id);
      } catch {
        // ignore — let parent show stale state until refresh
      }
    });
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border bg-card">
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
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold leading-tight">{title.title}</h3>
          <p className="text-xs text-muted-foreground">
            {`${title.year ?? "—"} · ${title.mediaType === "movie" ? "Movie" : "TV"}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {providerNames.length > 0 ? (
            providerNames.map((name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-[10px] italic text-muted-foreground">
              Not on your platforms right now
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">{addedAtLabel}</p>

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <button
            type="button"
            onClick={handleMarkWatched}
            disabled={pending}
            className="rounded-md border border-foreground bg-foreground px-2 py-1 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            Mark as watched
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium transition hover:border-foreground/40 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
