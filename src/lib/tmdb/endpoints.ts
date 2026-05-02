import "server-only";
import { tmdbFetch } from "./client";
import type {
  TmdbSearchResponse,
  TmdbWatchProvidersResponse,
  TmdbMovieDetail,
  TmdbTvDetail,
  TmdbMediaType,
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
