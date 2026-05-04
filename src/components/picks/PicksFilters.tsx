"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MOOD_OPTIONS,
  TIME_OPTIONS,
  type Mood,
  type TimeBudget,
} from "@/lib/recommender/filters";

interface Props {
  mood: Mood;
  time: TimeBudget;
}

export function PicksFilters({ mood, time }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: "mood" | "time", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "any") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/picks?${qs}` : "/picks");
    });
  }

  return (
    <section
      aria-busy={pending}
      className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Mood
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MOOD_OPTIONS.map((opt) => {
            const active = mood === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                disabled={pending}
                onClick={() => update("mood", opt.value)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/40",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Time
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TIME_OPTIONS.map((opt) => {
            const active = time === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                disabled={pending}
                onClick={() => update("time", opt.value)}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition disabled:opacity-50",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/40",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
