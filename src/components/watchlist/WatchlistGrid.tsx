"use client";

import { useState } from "react";
import Link from "next/link";
import { WatchlistCard } from "./WatchlistCard";
import type { RegionCode } from "@/lib/regions";
import type { Title } from "@/db/schema";

export interface SerializedEntry {
  title: Title;
  addedAtIso: string;
  addedAtLabel: string;
  providerIds: number[];
}

interface Props {
  initialEntries: SerializedEntry[];
  region: RegionCode;
}

export function WatchlistGrid({ initialEntries, region }: Props) {
  const [entries, setEntries] = useState<SerializedEntry[]>(initialEntries);

  function handleRemoved(titleId: string) {
    setEntries((prev) => prev.filter((e) => e.title.id !== titleId));
  }

  function handleMarkedWatched(titleId: string) {
    setEntries((prev) => prev.filter((e) => e.title.id !== titleId));
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/30 px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your watchlist is empty. Add titles from your picks.
        </p>
        <Link
          href="/picks"
          className="inline-flex h-8 items-center rounded-lg border border-foreground bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
        >
          Go to picks
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {`${entries.length} title${entries.length === 1 ? "" : "s"} saved.`}
      </p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {entries.map((e) => (
          <WatchlistCard
            key={e.title.id}
            title={e.title}
            addedAtLabel={e.addedAtLabel}
            providerIds={e.providerIds}
            region={region}
            onRemoved={handleRemoved}
            onMarkedWatched={handleMarkedWatched}
          />
        ))}
      </ul>
    </>
  );
}
