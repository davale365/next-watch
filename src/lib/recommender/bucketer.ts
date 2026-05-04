import type { Bucket, ScoredCandidate, TasteProfile } from "./types";
import { dominantMediaType } from "./profile";

const VOTE_COUNT_NOISE_FLOOR = 500;
const HIDDEN_GEM_RATING_FLOOR = 7.5;
const POPULARITY_PERCENTILE = 0.6;

function popularityCutoff(candidates: ScoredCandidate[]): number {
  if (candidates.length === 0) return Infinity;
  const sorted = candidates.map((c) => c.popularity).sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * POPULARITY_PERCENTILE);
  return sorted[idx] ?? sorted[sorted.length - 1];
}

function isStretch(
  c: ScoredCandidate,
  profile: TasteProfile,
  dominantMt: ReturnType<typeof dominantMediaType>
): boolean {
  if (profile.topGenres.length === 0 || c.genreIds.length === 0) return false;
  const dominantSet = new Set(profile.topGenres);
  const novelGenres = c.genreIds.filter((g) => !dominantSet.has(g)).length;
  const newMediaType = dominantMt != null && c.mediaType !== dominantMt;
  const qualityFloor = Math.min(profile.averageQuality - 0.5, 7.5);
  const qualityOk = c.voteAverage >= qualityFloor;
  return (newMediaType || novelGenres >= 2) && qualityOk;
}

function isHiddenGem(
  c: ScoredCandidate,
  popularityCutoffValue: number
): boolean {
  return (
    c.voteAverage >= HIDDEN_GEM_RATING_FLOOR &&
    c.voteCount >= VOTE_COUNT_NOISE_FLOOR &&
    c.popularity <= popularityCutoffValue
  );
}

function isSafe(c: ScoredCandidate, profile: TasteProfile): boolean {
  if (profile.topGenres.length === 0) return c.voteCount > 1000;
  const dominantSet = new Set(profile.topGenres);
  return c.genreIds.some((g) => dominantSet.has(g)) && c.voteCount >= 200;
}

export function bucketCandidates(
  candidates: ScoredCandidate[],
  profile: TasteProfile
): {
  safe: ScoredCandidate[];
  stretch: ScoredCandidate[];
  gem: ScoredCandidate[];
} {
  const dominantMt = dominantMediaType(profile);
  const popCutoff = popularityCutoff(candidates);

  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  const safe: ScoredCandidate[] = [];
  const stretch: ScoredCandidate[] = [];
  const gem: ScoredCandidate[] = [];

  for (const c of sorted) {
    if (isHiddenGem(c, popCutoff)) gem.push(c);
    if (isStretch(c, profile, dominantMt)) stretch.push(c);
    if (isSafe(c, profile)) safe.push(c);
  }

  return {
    safe,
    stretch,
    gem,
  };
}

export interface BucketSelection {
  picks: { bucket: Bucket; candidate: ScoredCandidate }[];
  backups: { bucket: Bucket; candidate: ScoredCandidate }[];
}

const BUCKET_ORDER: Bucket[] = ["safe", "stretch", "gem"];

export function selectPicksAndBackups(
  buckets: ReturnType<typeof bucketCandidates>,
  options: { backupsPerBucket?: number } = {}
): BucketSelection {
  const backupsPerBucket = options.backupsPerBucket ?? 2;
  const used = new Set<string>();
  const picks: BucketSelection["picks"] = [];
  const backups: BucketSelection["backups"] = [];

  const pools: Record<Bucket, ScoredCandidate[]> = {
    safe: buckets.safe,
    stretch: buckets.stretch,
    gem: buckets.gem,
  };

  for (const bucket of BUCKET_ORDER) {
    const pool = pools[bucket];
    for (const c of pool) {
      if (used.has(c.titleId)) continue;
      used.add(c.titleId);
      picks.push({ bucket, candidate: c });
      break;
    }
  }

  for (const bucket of BUCKET_ORDER) {
    const pool = pools[bucket];
    let added = 0;
    for (const c of pool) {
      if (added >= backupsPerBucket) break;
      if (used.has(c.titleId)) continue;
      used.add(c.titleId);
      backups.push({ bucket, candidate: c });
      added++;
    }
  }

  return { picks, backups };
}
