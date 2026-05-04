import type { Bucket, ScoredCandidate, TasteProfile } from "./types";
import type { Title } from "@/db/schema";
import { dominantMediaType } from "./profile";

const GENRE_NAMES: Record<number, string> = {
  28: "action",
  12: "adventure",
  16: "animation",
  35: "comedy",
  80: "crime",
  99: "documentary",
  18: "drama",
  10751: "family",
  14: "fantasy",
  36: "history",
  27: "horror",
  10402: "music",
  9648: "mystery",
  10749: "romance",
  878: "sci-fi",
  10770: "TV movie",
  53: "thriller",
  10752: "war",
  37: "western",
  10759: "action & adventure",
  10762: "kids",
  10763: "news",
  10764: "reality",
  10765: "sci-fi & fantasy",
  10766: "soap",
  10767: "talk",
  10768: "war & politics",
};

function genreName(id: number): string | null {
  return GENRE_NAMES[id] ?? null;
}

function namedGenreOverlap(
  candidate: ScoredCandidate,
  profile: TasteProfile
): string[] {
  const profileSet = new Set(profile.topGenres);
  const overlap = candidate.genreIds.filter((g) => profileSet.has(g));
  return overlap.map(genreName).filter((n): n is string => n !== null);
}

function novelGenreNames(
  candidate: ScoredCandidate,
  profile: TasteProfile
): string[] {
  const profileSet = new Set(profile.topGenres);
  return candidate.genreIds
    .filter((g) => !profileSet.has(g))
    .map(genreName)
    .filter((n): n is string => n !== null);
}

function bestAnchor(
  candidate: ScoredCandidate,
  profile: TasteProfile,
  anchorTitles: Title[]
): Title | null {
  if (anchorTitles.length === 0) return null;
  const candGenres = new Set(candidate.genreIds);
  let best: Title | null = null;
  let bestOverlap = -1;
  for (const a of anchorTitles) {
    const overlap = a.genres.filter((g) => candGenres.has(g)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = a;
    }
  }
  if (bestOverlap === 0) {
    return anchorTitles.find((a) => profile.positiveTitleIds.includes(a.id)) ??
      anchorTitles[0];
  }
  return best;
}

function pickFromHash(seed: string, options: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % options;
}

interface ReasonInput {
  candidate: ScoredCandidate;
  profile: TasteProfile;
  anchorTitles: Title[];
  bucket: Bucket;
}

function safeReason(input: ReasonInput): string {
  const { candidate, profile, anchorTitles } = input;
  const overlapGenres = namedGenreOverlap(candidate, profile);
  const anchor = bestAnchor(candidate, profile, anchorTitles);
  const variant = pickFromHash(candidate.titleId, 3);

  if (anchor && overlapGenres.length >= 2) {
    const templates = [
      `Because you reacted well to ${anchor.title} — this hits the same ${overlapGenres[0]} and ${overlapGenres[1]} notes.`,
      `Same wavelength as ${anchor.title} — both lean into ${overlapGenres[0]} and ${overlapGenres[1]}.`,
      `If ${anchor.title} landed for you, this should too — overlapping ${overlapGenres[0]} and ${overlapGenres[1]} energy.`,
    ];
    return templates[variant];
  }
  if (anchor && overlapGenres.length === 1) {
    const templates = [
      `Because you reacted well to ${anchor.title} — both lean into ${overlapGenres[0]}.`,
      `In the same ${overlapGenres[0]} pocket as ${anchor.title}.`,
      `Like ${anchor.title}, this has a strong ${overlapGenres[0]} core.`,
    ];
    return templates[variant];
  }
  if (anchor) {
    return `Strong overlap with ${anchor.title} based on what you've watched recently.`;
  }
  if (overlapGenres.length > 0) {
    return `Lands squarely in your ${overlapGenres[0]} comfort zone, with strong reviews to back it up.`;
  }
  return `A confident match for what you've been watching lately.`;
}

function stretchReason(input: ReasonInput): string {
  const { candidate, profile, anchorTitles } = input;
  const overlapGenres = namedGenreOverlap(candidate, profile);
  const novelGenres = novelGenreNames(candidate, profile);
  const anchor = bestAnchor(candidate, profile, anchorTitles);
  const dominantMt = dominantMediaType(profile);
  const isMtSwap = dominantMt != null && candidate.mediaType !== dominantMt;
  const variant = pickFromHash(candidate.titleId, 2);

  if (isMtSwap && anchor) {
    const formatLabel = candidate.mediaType === "tv" ? "series" : "film";
    return variant === 0
      ? `If ${anchor.title} hit, try this ${formatLabel} for a change of pace.`
      : `A ${formatLabel} take on territory next to ${anchor.title}.`;
  }
  if (anchor && novelGenres.length > 0 && overlapGenres.length > 0) {
    return variant === 0
      ? `A step beyond ${anchor.title} — same ${overlapGenres[0]} hook with a ${novelGenres[0]} twist.`
      : `Pulls the ${overlapGenres[0]} thread from titles like ${anchor.title} into ${novelGenres[0]} territory.`;
  }
  if (anchor && novelGenres.length > 0) {
    return `If you're ready to branch out from titles like ${anchor.title}, this ${novelGenres[0]} pick fits the bill.`;
  }
  if (novelGenres.length > 0) {
    return `A confident stretch into ${novelGenres[0]} — well-reviewed enough to be worth the leap.`;
  }
  return `A stretch from your usual lane — well-reviewed enough to be worth the risk.`;
}

function gemReason(input: ReasonInput): string {
  const { candidate, profile } = input;
  const overlapGenres = namedGenreOverlap(candidate, profile);
  const variant = pickFromHash(candidate.titleId, 2);
  const ratingPart =
    candidate.voteAverage >= 8
      ? `Critically loved (${candidate.voteAverage.toFixed(1)}/10)`
      : candidate.voteAverage >= 7.5
      ? `Quietly excellent (${candidate.voteAverage.toFixed(1)}/10)`
      : `Highly rated`;

  if (overlapGenres.length > 0) {
    return variant === 0
      ? `${ratingPart} but flying under the radar — and it's in the ${overlapGenres[0]} space you keep coming back to.`
      : `${ratingPart} pick that most people scroll past — sits right in your ${overlapGenres[0]} wheelhouse.`;
  }
  return `${ratingPart} pick most people miss — worth a look based on your tastes.`;
}

export function makeReason(input: ReasonInput): string {
  switch (input.bucket) {
    case "safe":
      return safeReason(input);
    case "stretch":
      return stretchReason(input);
    case "gem":
      return gemReason(input);
  }
}
