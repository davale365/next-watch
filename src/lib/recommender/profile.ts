import type { Title } from "@/db/schema";
import type { TasteProfile } from "./types";
import type { TmdbMediaType } from "@/lib/tmdb/types";
import type { FeedbackContribution } from "./feedback";

const REACTION_WEIGHT: Record<string, number> = {
  binged: 3,
  liked: 2,
  watched: 1,
  dropped: -1,
  not_for_me: -2,
};

function decadeOf(year: number | null): number | null {
  if (year == null) return null;
  return Math.floor(year / 10) * 10;
}

export function buildTasteProfile(
  reactions: { titleId: string; reaction: string }[],
  titlesById: Map<string, Title>,
  feedbackSignals: FeedbackContribution[] = []
): TasteProfile {
  const genreWeights = new Map<number, number>();
  const decadeWeights = new Map<number, number>();
  const mediaTypeWeights = new Map<TmdbMediaType, number>();
  const positiveTitleIds: string[] = [];
  let totalWeight = 0;
  let positiveWeight = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  function applySignal(title: Title, w: number) {
    totalWeight += Math.abs(w);
    if (w > 0) {
      positiveWeight += w;
      if (title.voteAverage != null) {
        qualitySum += title.voteAverage * w;
        qualityCount += w;
      }
    }
    for (const g of title.genres) {
      genreWeights.set(g, (genreWeights.get(g) ?? 0) + w);
    }
    const d = decadeOf(title.year);
    if (d != null) {
      decadeWeights.set(d, (decadeWeights.get(d) ?? 0) + w);
    }
    mediaTypeWeights.set(
      title.mediaType,
      (mediaTypeWeights.get(title.mediaType) ?? 0) + w
    );
  }

  for (const r of reactions) {
    const title = titlesById.get(r.titleId);
    if (!title) continue;
    const w = REACTION_WEIGHT[r.reaction] ?? 0;
    if (w === 0) continue;
    if (w > 0) positiveTitleIds.push(r.titleId);
    applySignal(title, w);
  }

  for (const s of feedbackSignals) {
    const title = titlesById.get(s.titleId);
    if (!title) continue;
    if (s.weight === 0) continue;
    if (s.weight > 0 && !positiveTitleIds.includes(s.titleId)) {
      positiveTitleIds.push(s.titleId);
    }
    applySignal(title, s.weight);
  }

  const topGenres = Array.from(genreWeights.entries())
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([g]) => g);

  const averageQuality = qualityCount > 0 ? qualitySum / qualityCount : 7.0;

  return {
    totalWeight,
    positiveWeight,
    genreWeights,
    decadeWeights,
    mediaTypeWeights,
    topGenres,
    averageQuality,
    positiveTitleIds,
  };
}

export function dominantMediaType(
  profile: TasteProfile
): TmdbMediaType | null {
  const movie = profile.mediaTypeWeights.get("movie") ?? 0;
  const tv = profile.mediaTypeWeights.get("tv") ?? 0;
  if (movie === 0 && tv === 0) return null;
  return movie > tv ? "movie" : "tv";
}
