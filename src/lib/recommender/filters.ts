import type { RawCandidate } from "./types";

export type Mood = "any" | "lighthearted" | "intense" | "thoughtful";
export type TimeBudget = "any" | "one_sitting" | "binge";

export const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: "any", label: "Any mood" },
  { value: "lighthearted", label: "Lighthearted" },
  { value: "intense", label: "Intense" },
  { value: "thoughtful", label: "Thoughtful" },
];

export const TIME_OPTIONS: { value: TimeBudget; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "one_sitting", label: "Just one sitting" },
  { value: "binge", label: "Time to binge" },
];

const MOOD_GENRES: Record<Exclude<Mood, "any">, Set<number>> = {
  lighthearted: new Set([35, 10751, 16, 10402, 14, 10749]),
  intense: new Set([53, 80, 28, 10752, 27, 9648, 10759, 10768]),
  thoughtful: new Set([18, 99, 36, 9648, 878, 10765]),
};

export function isMood(value: string | null | undefined): value is Mood {
  return (
    value === "any" ||
    value === "lighthearted" ||
    value === "intense" ||
    value === "thoughtful"
  );
}

export function isTimeBudget(
  value: string | null | undefined
): value is TimeBudget {
  return value === "any" || value === "one_sitting" || value === "binge";
}

export function parseMood(value: string | null | undefined): Mood {
  return isMood(value) ? value : "any";
}

export function parseTimeBudget(
  value: string | null | undefined
): TimeBudget {
  return isTimeBudget(value) ? value : "any";
}

export function applyMoodFilter(
  candidates: RawCandidate[],
  mood: Mood
): RawCandidate[] {
  if (mood === "any") return candidates;
  const allowed = MOOD_GENRES[mood];
  return candidates.filter((c) => c.genreIds.some((g) => allowed.has(g)));
}

export function applyTimeFilter(
  candidates: RawCandidate[],
  time: TimeBudget
): RawCandidate[] {
  if (time === "any") return candidates;
  if (time === "one_sitting") {
    return candidates.filter((c) => c.mediaType === "movie");
  }
  return candidates;
}
