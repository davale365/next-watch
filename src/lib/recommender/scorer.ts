import type { RawCandidate, ScoredCandidate, TasteProfile } from "./types";

const WEIGHTS = {
  taste: 0.45,
  socialProof: 0.3,
  moodFit: 0.1,
  diversity: 0.1,
  recency: 0.05,
};

function tasteMatchScore(
  candidate: RawCandidate,
  profile: TasteProfile
): number {
  if (profile.positiveWeight <= 0) return 0;
  let overlap = 0;
  for (const g of candidate.genreIds) {
    const w = profile.genreWeights.get(g) ?? 0;
    if (w > 0) overlap += w;
  }
  const genreFit = Math.min(1, overlap / (profile.positiveWeight * 1.2));
  const mediaFit =
    (profile.mediaTypeWeights.get(candidate.mediaType) ?? 0) /
    Math.max(1, profile.positiveWeight);
  return Math.min(1, genreFit * 0.85 + mediaFit * 0.15);
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
  profile: TasteProfile
): ScoredCandidate[] {
  return candidates.map((c) => {
    const taste = tasteMatchScore(c, profile);
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
  const taste = tasteMatchScore(candidate, profile);
  const social = socialProofScore(candidate);
  return 0.65 * taste + 0.35 * social;
}

export function confidenceFromScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}
