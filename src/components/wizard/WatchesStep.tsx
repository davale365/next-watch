"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TitleSearch } from "@/components/wizard/TitleSearch";
import { AddedTitleCard } from "@/components/wizard/AddedTitleCard";
import type { ReactionValue } from "@/components/wizard/ReactionPicker";
import { useWizardStore } from "@/state/wizard";
import { addTitleAction, type AddedTitle } from "@/lib/actions/titles";
import type { TitleSearchHit } from "@/lib/actions/search";

export const MIN_TITLES = 5;

interface DraftEntry {
  titleId: string;
  title: string;
  year: number | null;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  reaction: ReactionValue | null;
}

function fromAdded(a: AddedTitle): DraftEntry {
  return {
    titleId: a.title.id,
    title: a.title.title,
    year: a.title.year,
    mediaType: a.title.mediaType,
    posterPath: a.title.posterPath,
    reaction: a.reaction,
  };
}

export function WatchesStep({ initial }: { initial: AddedTitle[] }) {
  const router = useRouter();
  const back = useWizardStore((s) => s.back);
  const [entries, setEntries] = useState<DraftEntry[]>(() =>
    initial.map(fromAdded)
  );
  const [adding, startAdd] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const excludeIds = useMemo(
    () => new Set(entries.map((e) => e.titleId)),
    [entries]
  );

  function handleAdd(hit: TitleSearchHit) {
    setError(null);
    startAdd(async () => {
      try {
        const added = await addTitleAction({
          tmdbId: hit.tmdbId,
          mediaType: hit.mediaType,
        });
        setEntries((prev) => {
          if (prev.some((e) => e.titleId === added.title.id)) return prev;
          return [...prev, fromAdded(added)];
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add title");
      }
    });
  }

  function handleReaction(titleId: string, reaction: ReactionValue) {
    setEntries((prev) =>
      prev.map((e) => (e.titleId === titleId ? { ...e, reaction } : e))
    );
  }

  function handleRemove(titleId: string) {
    setEntries((prev) => prev.filter((e) => e.titleId !== titleId));
  }

  const withReaction = entries.filter((e) => e.reaction !== null).length;
  const remaining = Math.max(0, MIN_TITLES - withReaction);
  const canContinue = withReaction >= MIN_TITLES;

  function handleContinue() {
    if (!canContinue) return;
    router.push("/picks");
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Add 5 things you&apos;ve watched recently
        </h2>
        <p className="text-sm text-muted-foreground">
          For each one, tell us how it landed. The more honest you are, the
          better we can spot what&apos;s next.
        </p>
      </header>

      <TitleSearch excludeIds={excludeIds} onSelect={handleAdd} />
      {adding && (
        <p className="text-sm text-muted-foreground">Adding title…</p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Your recent watches ({entries.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            {withReaction} / {MIN_TITLES} with a reaction
          </span>
        </div>
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing added yet — search above to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <AddedTitleCard
                key={e.titleId}
                titleId={e.titleId}
                title={e.title}
                year={e.year}
                mediaType={e.mediaType}
                posterPath={e.posterPath}
                reaction={e.reaction}
                onReaction={handleReaction}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => back()}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {!canContinue && (
            <span className="text-xs text-muted-foreground">
              {remaining > 0
                ? `Add ${remaining} more title${remaining > 1 ? "s" : ""} with a reaction.`
                : "Pick a reaction for every title."}
            </span>
          )}
          <Button onClick={handleContinue} disabled={!canContinue}>
            Get My Picks
          </Button>
        </div>
      </div>
    </section>
  );
}
