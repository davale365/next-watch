import "server-only";
import { tmdbFetch } from "./client";
import type {
  TmdbSearchResponse,
  TmdbWatchProvidersResponse,
  TmdbMovieDetail,
  TmdbTvDetail,
  TmdbMediaType,
  TmdbDiscoverResponse,
  TmdbCandidatePage,
} from "./types";

export function searchMulti(query: string, region?: string) {
  return tmdbFetch<TmdbSearchResponse>("/search/multi", {
    query,
    include_adult: "false",
    language: "en-GB",
    page: 1,
    region,
  });
}

export function getWatchProviders(mediaType: TmdbMediaType, tmdbId: number) {
  return tmdbFetch<TmdbWatchProvidersResponse>(
    `/${mediaType}/${tmdbId}/watch/providers`,
    {},
    { ttlMs: 1000 * 60 * 60 }
  );
}

export function getMovieDetail(tmdbId: number) {
  return tmdbFetch<TmdbMovieDetail>(`/movie/${tmdbId}`, {
    language: "en-GB",
  });
}

export function getTvDetail(tmdbId: number) {
  return tmdbFetch<TmdbTvDetail>(`/tv/${tmdbId}`, {
    language: "en-GB",
  });
}

export function getRecommendations(
  mediaType: TmdbMediaType,
  tmdbId: number,
  region?: string
) {
  return tmdbFetch<TmdbCandidatePage>(
    `/${mediaType}/${tmdbId}/recommendations`,
    { language: "en-GB", page: 1, region },
    { ttlMs: 1000 * 60 * 60 }
  );
}

export function getSimilar(mediaType: TmdbMediaType, tmdbId: number) {
  return tmdbFetch<TmdbCandidatePage>(
    `/${mediaType}/${tmdbId}/similar`,
    { language: "en-GB", page: 1 },
    { ttlMs: 1000 * 60 * 60 }
  );
}

export function discoverByGenres(input: {
  mediaType: TmdbMediaType;
  genreIds: number[];
  region?: string;
  voteCountGte?: number;
  page?: number;
}) {
  const params: Record<string, string | number | undefined> = {
    language: "en-GB",
    sort_by: "popularity.desc",
    include_adult: "false",
    page: input.page ?? 1,
    with_genres: input.genreIds.join(","),
    "vote_count.gte": input.voteCountGte ?? 100,
    watch_region: input.region,
  };
  return tmdbFetch<TmdbDiscoverResponse>(
    `/discover/${input.mediaType}`,
    params,
    { ttlMs: 1000 * 60 * 30 }
  );
}
