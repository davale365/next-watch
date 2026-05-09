import type { Title } from "@/db/schema";
import type { RawCandidate, ScoredCandidate, TasteProfile } from "./types";

const WEIGHTS = {
  taste: 0.45,
  socialProof: 0.3,
  moodFit: 0.1,
  diversity: 0.1,
  recency: 0.05,
};

const CAST_BONUS = 0.15;
const DIRECTOR_BONUS = 0.1;

function genreOverlap(candidate: RawCandidate, profile: TasteProfile): number {
  if (profile.positiveWeight <= 0) return 0;
  let overlap = 0;
  for (const g of candidate.genreIds) {
    const w = profile.genreWeights.get(g) ?? 0;
    if (w > 0) overlap += w;
  }
  return Math.min(1, overlap / (profile.positiveWeight * 1.2));
}

function mediaFit(candidate: RawCandidate, profile: TasteProfile): number {
  if (profile.positiveWeight <= 0) return 0;
  return (
    (profile.mediaTypeWeights.get(candidate.mediaType) ?? 0) /
    Math.max(1, profile.positiveWeight)
  );
}

function castFit(
  candidate: RawCandidate,
  profile: TasteProfile,
  enrichment?: Title
): number {
  if (!enrichment || enrichment.castTop.length === 0) return 0;
  if (profile.totalCastWeight <= 0) return 0;
  let overlap = 0;
  for (const id of enrichment.castTop) {
    const w = profile.castWeights.get(id) ?? 0;
    if (w > 0) overlap += w;
  }
  return Math.min(1, overlap / profile.totalCastWeight);
}

function directorFit(
  candidate: RawCandidate,
  profile: TasteProfile,
  enrichment?: Title
): number {
  if (!enrichment || enrichment.directors.length === 0) return 0;
  if (profile.totalDirectorWeight <= 0) return 0;
  let overlap = 0;
  for (const id of enrichment.directors) {
    const w = profile.directorWeights.get(id) ?? 0;
    if (w > 0) overlap += w;
  }
  return Math.min(1, overlap / profile.totalDirectorWeight);
}

function tasteMatchScore(
  candidate: RawCandidate,
  profile: TasteProfile,
  enrichment?: Title
): number {
  const g = genreOverlap(candidate, profile);
  const m = mediaFit(candidate, profile);
  const base = g * 0.85 + m * 0.15;
  const cast = castFit(candidate, profile, enrichment) * CAST_BONUS;
  const dir = directorFit(candidate, profile, enrichment) * DIRECTOR_BONUS;
  return Math.min(1, base + cast + dir);
}

function socialProofScore(candidate: RawCandidate): number {
  const ratingNorm = Math.max(0, Math.min(1, candidate.voteAverage / 10));
  const voteNorm =
    candidate.voteCount > 0
      ? Math.min(1, Math.log10(candidate.voteCount) / Math.log10(50000))
      : 0;
  const popularityNorm = Math.min(1, candidate.popularity / 200);
  return Math.min(
    1,
    ratingNorm * voteNorm * 0.7 + popularityNorm * 0.3
  );
}

function recencyScore(candidate: RawCandidate): number {
  if (candidate.year == null) return 0.5;
  const age = new Date().getUTCFullYear() - candidate.year;
  if (age <= 0) return 1;
  if (age < 25) return 1;
  if (age < 40) return 0.8;
  return candidate.voteCount >= 1500 ? 0.7 : 0.5;
}

function moodFitScore(): number {
  return 0;
}

export function scoreCandidates(
  candidates: RawCandidate[],
  profile: TasteProfile,
  titlesById?: Map<string, Title>
): ScoredCandidate[] {
  return candidates.map((c) => {
    const enrichment = titlesById?.get(c.titleId);
    const taste = tasteMatchScore(c, profile, enrichment);
    const socialProof = socialProofScore(c);
    const moodFit = moodFitScore();
    const diversity = 0;
    const recency = recencyScore(c);
    const score =
      WEIGHTS.taste * taste +
      WEIGHTS.socialProof * socialProof +
      WEIGHTS.moodFit * moodFit +
      WEIGHTS.diversity * diversity +
      WEIGHTS.recency * recency;
    return {
      ...c,
      score,
      components: { taste, socialProof, moodFit, diversity, recency },
    };
  });
}

export function preliminaryScore(
  candidate: RawCandidate,
  profile: TasteProfile
): number {
  const g = genreOverlap(candidate, profile);
  const m = mediaFit(candidate, profile);
  const taste = g * 0.85 + m * 0.15;
  const social = socialProofScore(candidate);
  return 0.65 * taste + 0.35 * social;
}

export function confidenceFromScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}
