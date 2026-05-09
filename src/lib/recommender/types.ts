import type { TmdbMediaType } from "@/lib/tmdb/types";

export type Bucket = "safe" | "stretch" | "gem";

export interface TasteProfile {
  totalWeight: number;
  positiveWeight: number;
  genreWeights: Map<number, number>;
  decadeWeights: Map<number, number>;
  mediaTypeWeights: Map<TmdbMediaType, number>;
  castWeights: Map<number, number>;
  directorWeights: Map<number, number>;
  keywordWeights: Map<number, number>;
  castNames: Map<number, string>;
  directorNames: Map<number, string>;
  totalCastWeight: number;
  totalDirectorWeight: number;
  totalKeywordWeight: number;
  topGenres: number[];
  averageQuality: number;
  positiveTitleIds: string[];
}

export interface RawCandidate {
  titleId: string;
  tmdbId: number;
  mediaType: TmdbMediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  popularity: number;
  source: "recommendations" | "similar" | "discover";
  sourceTitleId?: string;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  components: {
    taste: number;
    socialProof: number;
    moodFit: number;
    diversity: number;
    recency: number;
  };
}

export interface Pick {
  titleId: string;
  tmdbId: number;
  mediaType: TmdbMediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  bucket: Bucket;
  confidence: number;
  reason: string;
  providerIds: number[];
}

export interface PicksResult {
  slate: Pick[];
  queue: Pick[];
  message?: string;
  reason?: "ok" | "needs_more_titles" | "no_platforms" | "thin_slate" | "no_picks";
}
