"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PickCard, type FeedbackAction } from "./PickCard";
import { recordFeedbackAction } from "@/lib/actions/feedback";
import type { Pick } from "@/lib/recommender/types";
import type { RegionCode } from "@/lib/regions";

interface Props {
  initialSlate: Pick[];
  initialQueue: Pick[];
  region: RegionCode;
  sessionId: string;
}

const SLATE_SIZE = 3;

export function PicksClient({
  initialSlate,
  initialQueue,
  region,
  sessionId,
}: Props) {
  const router = useRouter();
  const [slate, setSlate] = useState<(Pick | null)[]>(() => {
    const padded: (Pick | null)[] = [...initialSlate];
    while (padded.length < SLATE_SIZE) padded.push(null);
    return padded;
  });
  const [queue, setQueue] = useState<Pick[]>(initialQueue);
  const [error, setError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const exhausted = useMemo(
    () => slate.every((p) => p === null) && queue.length === 0,
    [slate, queue]
  );

  function popReplacement(bucket: Pick["bucket"]): {
    next: Pick | null;
    nextQueue: Pick[];
  } {
    const sameBucketIdx = queue.findIndex((p) => p.bucket === bucket);
    if (sameBucketIdx >= 0) {
      const next = queue[sameBucketIdx];
      const nextQueue = queue.filter((_, i) => i !== sameBucketIdx);
      return { next, nextQueue };
    }
    if (queue.length > 0) {
      return { next: queue[0], nextQueue: queue.slice(1) };
    }
    return { next: null, nextQueue: queue };
  }

  async function handleAction(pick: Pick, action: FeedbackAction) {
    const idx = slate.findIndex((p) => p && p.titleId === pick.titleId);
    if (idx < 0) return;
    setError(null);

    const removeFromSlate = action !== "interested";
    if (removeFromSlate) {
      const { next, nextQueue } = popReplacement(pick.bucket);
      setSlate((prev) => prev.map((p, i) => (i === idx ? next : p)));
      setQueue(nextQueue);
    }

    if (action === "watchlist") {
      setSavedTitle(pick.title);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedTitle(null), 3500);
    }

    try {
      await recordFeedbackAction({
        titleId: pick.titleId,
        action,
        bucket: pick.bucket,
        sessionId,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't save that — please try again."
      );
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  const hasAnyVisible = slate.some((p) => p !== null);

  return (
    <div className="flex flex-col gap-6">
      {savedTitle && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <span>
            Saved <span className="font-medium">{savedTitle}</span> to your
            watchlist.
          </span>
          <Link
            href="/watchlist"
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            View watchlist
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {slate.map((pick, idx) => (
          <div key={`slot-${idx}`} className="min-h-[200px]">
            {pick ? (
              <PickCard pick={pick} region={region} onAction={handleAction} />
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                <p>No more picks in this slot.</p>
                <p className="mt-1 text-xs">
                  Try refreshing or expanding your platform list.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {exhausted && (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          You&apos;ve worked through every pick we had. Refresh for a new
          set, or come back after a few more recent watches.
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hasAnyVisible
            ? `${queue.length} more in the queue`
            : "Queue empty"}
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:border-foreground/40"
        >
          Refresh picks
        </button>
      </div>
    </div>
  );
}
