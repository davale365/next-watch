import type { Bucket, ScoredCandidate, TasteProfile } from "./types";
import type { Title } from "@/db/schema";

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

function pickAnchor(profile: TasteProfile, anchorTitles: Title[]): Title | null {
  if (anchorTitles.length === 0) return null;
  for (const id of profile.positiveTitleIds) {
    const t = anchorTitles.find((a) => a.id === id);
    if (t) return t;
  }
  return anchorTitles[0];
}

export function makeReason(input: {
  candidate: ScoredCandidate;
  profile: TasteProfile;
  anchorTitles: Title[];
  bucket: Bucket;
}): string {
  const { candidate, profile, anchorTitles, bucket } = input;
  const overlapGenres = namedGenreOverlap(candidate, profile);
  const anchor = pickAnchor(profile, anchorTitles);

  if (bucket === "gem") {
    const ratingPart =
      candidate.voteAverage >= 7.5
        ? `Critically loved (${candidate.voteAverage.toFixed(1)}/10)`
        : `Highly rated`;
    if (overlapGenres.length > 0) {
      return `${ratingPart} but flying under the radar — and it's in the ${overlapGenres[0]} space you keep coming back to.`;
    }
    return `${ratingPart} pick most people miss — worth a look based on your tastes.`;
  }

  if (bucket === "stretch") {
    if (anchor && overlapGenres.length > 0) {
      return `A step beyond ${anchor.title} — same ${overlapGenres[0]} energy with a fresh angle.`;
    }
    if (anchor) {
      return `If you're ready to branch out from titles like ${anchor.title}, this fits the bill.`;
    }
    if (overlapGenres.length > 0) {
      return `A confident stretch into territory next to your ${overlapGenres[0]} picks.`;
    }
    return `A stretch from your usual lane — well-reviewed enough to be worth the risk.`;
  }

  if (anchor && overlapGenres.length >= 2) {
    return `Because you reacted well to ${anchor.title} — this hits the same ${overlapGenres[0]} and ${overlapGenres[1]} notes.`;
  }
  if (anchor && overlapGenres.length === 1) {
    return `Because you reacted well to ${anchor.title} — both lean into ${overlapGenres[0]}.`;
  }
  if (anchor) {
    return `Strong overlap with ${anchor.title} based on what you've watched recently.`;
  }
  if (overlapGenres.length > 0) {
    return `Lands squarely in your ${overlapGenres[0]} comfort zone with strong reviews.`;
  }
  return `A confident match for what you've been watching lately.`;
}
