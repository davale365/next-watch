import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  feedbackEvents,
  reactions,
  titles,
  type Title,
  type User,
} from "@/db/schema";
import { TmdbAvailabilityProvider } from "@/lib/availability/tmdb-provider";
import { upsertShallowTitle } from "@/lib/titles/upsert";
import type { RegionCode } from "@/lib/regions";
import { generateCandidates } from "./candidates";
import { buildTasteProfile } from "./profile";
import {
  bucketCandidates,
  selectPicksAndBackups,
} from "./bucketer";
import {
  applyMoodFilter,
  applyTimeFilter,
  type Mood,
  type TimeBudget,
} from "./filters";
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
  const reactionTitlesRows = await db
    .select()
    .from(titles)
    .where(inArray(titles.id, reactionTitleIds));
  const titlesById = new Map(reactionTitlesRows.map((t) => [t.id, t]));
  const profile = buildTasteProfile(userReactions, titlesById);

  const positiveTitles = profile.positiveTitleIds
    .map((id) => titlesById.get(id))
    .filter((t): t is Title => t != null);

  const negativeFeedbackRows = await db
    .select({ titleId: feedbackEvents.titleId })
    .from(feedbackEvents)
    .where(
      and(
        eq(feedbackEvents.userId, user.id),
        inArray(feedbackEvents.action, ["not_for_me", "already_seen"])
      )
    );

  const excludeIds = new Set<string>([
    ...reactionTitleIds,
    ...negativeFeedbackRows.map((r) => r.titleId),
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

  const withAvailability = await lazyAvailability(
    prelimRanked,
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

export const PICKS_CONFIDENCE_FLOOR = CONFIDENCE_FLOOR;
