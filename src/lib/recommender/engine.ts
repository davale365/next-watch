import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  reactions,
  titles,
  type Title,
  type User,
} from "@/db/schema";
import { TmdbAvailabilityProvider } from "@/lib/availability/tmdb-provider";
import { setRuntimeIfMissing, upsertShallowTitle } from "@/lib/titles/upsert";
import { getMovieDetail } from "@/lib/tmdb/endpoints";
import type { RegionCode } from "@/lib/regions";
import { generateCandidates } from "./candidates";
import { buildTasteProfile } from "./profile";
import {
  bucketCandidates,
  selectPicksAndBackups,
} from "./bucketer";
import {
  applyMoodFilter,
  applyRuntimeFilter,
  applyTimeFilter,
  RUNTIME_CAPS,
  type Mood,
  type TimeBudget,
} from "./filters";
import { loadFeedbackForUser } from "./feedback";
import { makeReason } from "./reasons";
import {
  confidenceFromScore,
  preliminaryScore,
  scoreCandidates,
} from "./scorer";
import type {
  Pick,
  PicksResult,
  RawCandidate,
  ScoredCandidate,
} from "./types";

const MIN_REACTIONS = 5;
const TOP_N_FOR_AVAILABILITY = 30;
const CONFIDENCE_FLOOR = 60;
const SLATE_SIZE = 3;
const BACKUPS_PER_BUCKET = 2;
const PROVIDER_FETCH_CONCURRENCY = 6;

async function pMap<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function loop() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => loop())
  );
  return out;
}

interface PerTitleAvailability {
  candidate: RawCandidate;
  providerIds: number[];
}

async function lazyAvailability(
  candidates: RawCandidate[],
  region: RegionCode,
  selectedPlatforms: Set<number>
): Promise<PerTitleAvailability[]> {
  const provider = new TmdbAvailabilityProvider();
  return pMap(
    candidates,
    async (c) => {
      try {
        const rows = await provider.getProviders({
          titleId: c.titleId,
          tmdbId: c.tmdbId,
          mediaType: c.mediaType,
          region,
        });
        const providerIds = Array.from(
          new Set(
            rows
              .filter(
                (r) =>
                  r.monetization === "flatrate" ||
                  r.monetization === "free" ||
                  r.monetization === "ads"
              )
              .map((r) => r.providerId)
          )
        ).filter((id) => selectedPlatforms.has(id));
        return { candidate: c, providerIds };
      } catch {
        return { candidate: c, providerIds: [] };
      }
    },
    PROVIDER_FETCH_CONCURRENCY
  );
}

async function persistShallow(c: RawCandidate): Promise<void> {
  try {
    await upsertShallowTitle({
      mediaType: c.mediaType,
      tmdbId: c.tmdbId,
      title: c.title,
      year: c.year,
      posterPath: c.posterPath,
      overview: c.overview,
      genres: c.genreIds,
      voteAverage: c.voteAverage,
      voteCount: c.voteCount,
      popularity: c.popularity,
    });
  } catch (err) {
    console.warn("[engine] persistShallow failed for", c.titleId, err);
  }
}

async function loadRuntimes(
  candidates: RawCandidate[]
): Promise<Map<string, number | null>> {
  const db = getDb();
  const ids = candidates.map((c) => c.titleId);
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: titles.id, runtimeMinutes: titles.runtimeMinutes })
    .from(titles)
    .where(inArray(titles.id, ids));
  return new Map(rows.map((r) => [r.id, r.runtimeMinutes]));
}

async function enrichMissingMovieRuntimes(
  candidates: RawCandidate[],
  runtimes: Map<string, number | null>
): Promise<void> {
  const needs = candidates.filter(
    (c) => c.mediaType === "movie" && runtimes.get(c.titleId) == null
  );
  if (needs.length === 0) return;
  await pMap(
    needs,
    async (c) => {
      try {
        const detail = await getMovieDetail(c.tmdbId);
        const runtime =
          typeof detail.runtime === "number" && detail.runtime > 0
            ? detail.runtime
            : null;
        runtimes.set(c.titleId, runtime);
        if (runtime != null) await setRuntimeIfMissing(c.titleId, runtime);
      } catch {
        // leave runtime null in the map → strict policy in applyRuntimeFilter excludes
      }
    },
    PROVIDER_FETCH_CONCURRENCY
  );
}

function toPick(
  scored: ScoredCandidate,
  bucket: Pick["bucket"],
  reason: string,
  providerIds: number[]
): Pick {
  return {
    titleId: scored.titleId,
    tmdbId: scored.tmdbId,
    mediaType: scored.mediaType,
    title: scored.title,
    year: scored.year,
    posterPath: scored.posterPath,
    overview: scored.overview,
    bucket,
    confidence: confidenceFromScore(scored.score),
    reason,
    providerIds,
  };
}

export interface GetPicksOptions {
  mood?: Mood;
  time?: TimeBudget;
  transientExcludeIds?: Iterable<string>;
}

export async function getPicks(
  user: User,
  options: GetPicksOptions = {}
): Promise<PicksResult> {
  const db = getDb();
  if (user.selectedPlatforms.length === 0) {
    return {
      slate: [],
      queue: [],
      reason: "no_platforms",
      message: "Pick at least one streaming platform to get recommendations.",
    };
  }

  const userReactions = await db
    .select()
    .from(reactions)
    .where(eq(reactions.userId, user.id));

  if (userReactions.length < MIN_REACTIONS) {
    return {
      slate: [],
      queue: [],
      reason: "needs_more_titles",
      message: `Add ${MIN_REACTIONS - userReactions.length} more recent watch${
        MIN_REACTIONS - userReactions.length === 1 ? "" : "es"
      } with a reaction to unlock recommendations.`,
    };
  }

  const reactionTitleIds = userReactions.map((r) => r.titleId);
  const feedback = await loadFeedbackForUser(user.id);

  const titleIdsToLoad = new Set<string>([
    ...reactionTitleIds,
    ...feedback.signals.map((s) => s.titleId),
  ]);
  const titleRows =
    titleIdsToLoad.size > 0
      ? await db
          .select()
          .from(titles)
          .where(inArray(titles.id, Array.from(titleIdsToLoad)))
      : [];
  const titlesById = new Map(titleRows.map((t) => [t.id, t]));

  const profile = buildTasteProfile(
    userReactions,
    titlesById,
    feedback.signals
  );

  const positiveTitles = profile.positiveTitleIds
    .map((id) => titlesById.get(id))
    .filter((t): t is Title => t != null);

  const excludeIds = new Set<string>([
    ...reactionTitleIds,
    ...feedback.excludedTitleIds,
    ...(options.transientExcludeIds ?? []),
  ]);

  const region = user.region as RegionCode;
  const selectedPlatforms = new Set(user.selectedPlatforms);

  const rawCandidates = await generateCandidates({
    positiveTitles,
    topGenres: profile.topGenres,
    region,
    excludeIds,
  });

  if (rawCandidates.length === 0) {
    return {
      slate: [],
      queue: [],
      reason: "no_picks",
      message:
        "We couldn't find good matches for your selected platforms — try adding more, or pick a wider mix of recent watches.",
    };
  }

  const mood = options.mood ?? "any";
  const time = options.time ?? "any";
  const moodFiltered = applyMoodFilter(rawCandidates, mood);
  const candidates = applyTimeFilter(moodFiltered, time);

  if (candidates.length === 0) {
    return {
      slate: [],
      queue: [],
      reason: "no_picks",
      message:
        "Your mood or time filter is leaving us empty-handed. Try widening one of them.",
    };
  }

  const prelimRanked = candidates
    .map((c) => ({ c, prelim: preliminaryScore(c, profile) }))
    .sort((a, b) => b.prelim - a.prelim)
    .slice(0, TOP_N_FOR_AVAILABILITY)
    .map((x) => x.c);

  await pMap(prelimRanked, persistShallow, PROVIDER_FETCH_CONCURRENCY);

  const runtimeCap = RUNTIME_CAPS[time];
  let runtimeFiltered: RawCandidate[] = prelimRanked;
  if (runtimeCap != null) {
    const runtimeMap = await loadRuntimes(prelimRanked);
    await enrichMissingMovieRuntimes(prelimRanked, runtimeMap);
    runtimeFiltered = applyRuntimeFilter(prelimRanked, time, runtimeMap);
    if (runtimeFiltered.length === 0) {
      return {
        slate: [],
        queue: [],
        reason: "no_picks",
        message:
          "No movies in your shortlist fit that time budget. Try widening the time filter or your platforms.",
      };
    }
  }

  const withAvailability = await lazyAvailability(
    runtimeFiltered,
    region,
    selectedPlatforms
  );
  const playable = withAvailability.filter((p) => p.providerIds.length > 0);

  if (playable.length === 0) {
    return {
      slate: [],
      queue: [],
      reason: "no_picks",
      message:
        "Nothing in your matches is available on your platforms right now. Add more platforms or refresh later.",
    };
  }

  const scored = scoreCandidates(
    playable.map((p) => p.candidate),
    profile
  );
  const providerIdsByTitleId = new Map(
    playable.map((p) => [p.candidate.titleId, p.providerIds])
  );

  const buckets = bucketCandidates(scored, profile);
  const selection = selectPicksAndBackups(buckets, {
    backupsPerBucket: BACKUPS_PER_BUCKET,
  });

  const anchorTitles = positiveTitles;

  const slate: Pick[] = [];
  for (const { bucket, candidate } of selection.picks) {
    const confidence = confidenceFromScore(candidate.score);
    if (confidence < CONFIDENCE_FLOOR) continue;
    const reason = makeReason({
      candidate,
      profile,
      anchorTitles,
      bucket,
    });
    slate.push(
      toPick(candidate, bucket, reason, providerIdsByTitleId.get(candidate.titleId) ?? [])
    );
  }

  const queue: Pick[] = [];
  for (const { bucket, candidate } of selection.backups) {
    const confidence = confidenceFromScore(candidate.score);
    if (confidence < CONFIDENCE_FLOOR) continue;
    const reason = makeReason({
      candidate,
      profile,
      anchorTitles,
      bucket,
    });
    queue.push(
      toPick(candidate, bucket, reason, providerIdsByTitleId.get(candidate.titleId) ?? [])
    );
  }

  if (slate.length < SLATE_SIZE) {
    const filterActive = mood !== "any" || time !== "any";
    const cleared =
      slate.length === 0
        ? "We don't have any picks above our confidence bar yet."
        : `Only ${slate.length} pick${slate.length === 1 ? "" : "s"} cleared our confidence bar.`;
    const fix = filterActive
      ? "Try widening your mood or time filter, or add more recent watches with reactions."
      : "Add 2 more recent watches with reactions to unlock stronger recommendations.";
    return {
      slate,
      queue,
      reason: "thin_slate",
      message: `${cleared} ${fix}`,
    };
  }

  return {
    slate,
    queue,
    reason: "ok",
  };
}
