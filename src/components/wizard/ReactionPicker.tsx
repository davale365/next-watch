"use client";

import { useTransition } from "react";
import { setReactionAction } from "@/lib/actions/titles";

export const REACTION_OPTIONS = [
  { value: "binged", label: "Binged it" },
  { value: "liked", label: "Liked it" },
  { value: "watched", label: "Watched normally" },
  { value: "dropped", label: "Dropped it" },
  { value: "not_for_me", label: "Not for me" },
] as const;

export type ReactionValue = (typeof REACTION_OPTIONS)[number]["value"];

interface Props {
  titleId: string;
  current: ReactionValue | null;
  onChange: (reaction: ReactionValue) => void;
}

export function ReactionPicker({ titleId, current, onChange }: Props) {
  const [pending, startTransition] = useTransition();

  function handleSelect(value: ReactionValue) {
    startTransition(async () => {
      await setReactionAction({ titleId, reaction: value });
      onChange(value);
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="How did you feel about it?"
      className="flex flex-wrap gap-1.5"
    >
      {REACTION_OPTIONS.map((opt) => {
        const isSelected = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={pending}
            onClick={() => handleSelect(opt.value)}
            className={[
              "rounded-full border px-3 py-1 text-xs transition",
              isSelected
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground hover:border-foreground/40",
              pending ? "opacity-60" : "",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
