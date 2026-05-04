export type TmdbMediaType = "movie" | "tv";

export interface TmdbSearchMovie {
  id: number;
  media_type: "movie";
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path: string | null;
  overview: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
}

export interface TmdbSearchTv {
  id: number;
  media_type: "tv";
  name: string;
  original_name?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
}

export interface TmdbSearchPerson {
  id: number;
  media_type: "person";
  name: string;
}

export type TmdbSearchResult = TmdbSearchMovie | TmdbSearchTv | TmdbSearchPerson;

export interface TmdbSearchResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbSearchResult[];
}

export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  display_priority: number;
  logo_path: string | null;
}

export interface TmdbRegionProviders {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
}

export interface TmdbWatchProvidersResponse {
  id: number;
  results: Record<string, TmdbRegionProviders | undefined>;
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TmdbTvDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TmdbCandidate {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

export interface TmdbCandidatePage {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbCandidate[];
}

export type TmdbDiscoverResponse = TmdbCandidatePage;
