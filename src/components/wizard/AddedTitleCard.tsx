"use client";

import { useTransition } from "react";
import { posterUrl } from "@/lib/tmdb/images";
import { removeTitleAction } from "@/lib/actions/titles";
import {
  ReactionPicker,
  type ReactionValue,
} from "@/components/wizard/ReactionPicker";

interface Props {
  titleId: string;
  title: string;
  year: number | null;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  reaction: ReactionValue | null;
  onReaction: (titleId: string, reaction: ReactionValue) => void;
  onRemove: (titleId: string) => void;
}

export function AddedTitleCard({
  titleId,
  title,
  year,
  mediaType,
  posterPath,
  reaction,
  onReaction,
  onRemove,
}: Props) {
  const [removing, startRemove] = useTransition();
  const poster = posterUrl(posterPath, "w185");

  function handleRemove() {
    startRemove(async () => {
      await removeTitleAction({ titleId });
      onRemove(titleId);
    });
  }

  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          width={56}
          height={84}
          className="h-[84px] w-14 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-[84px] w-14 shrink-0 rounded bg-muted" />
      )}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-medium leading-tight">{title}</span>
            <span className="text-xs text-muted-foreground">
              {year ?? "—"} · {mediaType === "movie" ? "Movie" : "TV"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
        <ReactionPicker
          titleId={titleId}
          current={reaction}
          onChange={(r) => onReaction(titleId, r)}
        />
      </div>
    </li>
  );
}
