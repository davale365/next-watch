import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { titles, type Title } from "@/db/schema";
import { getMovieDetail, getTvDetail } from "@/lib/tmdb/endpoints";
import type { TmdbMediaType } from "@/lib/tmdb/types";
import type { RegionCode } from "@/lib/regions";
import { TmdbAvailabilityProvider } from "@/lib/availability/tmdb-provider";

export function makeTitleId(mediaType: TmdbMediaType, tmdbId: number) {
  return `${mediaType}:${tmdbId}`;
}

export interface ShallowTitleInput {
  mediaType: TmdbMediaType;
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  overview: string;
  genres: number[];
  voteAverage: number;
  voteCount: number;
  popularity: number;
}

export async function upsertShallowTitle(
  input: ShallowTitleInput
): Promise<Title> {
  const id = makeTitleId(input.mediaType, input.tmdbId);
  const db = getDb();
  const row = {
    id,
    tmdbId: input.tmdbId,
    mediaType: input.mediaType,
    title: input.title,
    year: input.year,
    posterPath: input.posterPath,
    overview: input.overview,
    runtimeMinutes: null,
    genres: input.genres,
    keywords: [],
    castTop: [],
    directors: [],
    voteAverage: input.voteAverage,
    voteCount: input.voteCount,
    popularity: input.popularity,
    fetchedAt: new Date(),
  };
  const [persisted] = await db
    .insert(titles)
    .values(row)
    .onConflictDoUpdate({
      target: titles.id,
      set: {
        title: row.title,
        year: row.year,
        posterPath: row.posterPath,
        overview: row.overview,
        genres: row.genres,
        voteAverage: row.voteAverage,
        voteCount: row.voteCount,
        popularity: row.popularity,
        fetchedAt: new Date(),
      },
    })
    .returning();
  return persisted;
}

function yearFromDate(date: string | undefined): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export async function upsertTitle(input: {
  mediaType: TmdbMediaType;
  tmdbId: number;
}): Promise<Title> {
  const id = makeTitleId(input.mediaType, input.tmdbId);
  const db = getDb();

  if (input.mediaType === "movie") {
    const detail = await getMovieDetail(input.tmdbId);
    const row = {
      id,
      tmdbId: detail.id,
      mediaType: "movie" as const,
      title: detail.title,
      year: yearFromDate(detail.release_date),
      posterPath: detail.poster_path,
      overview: detail.overview ?? null,
      runtimeMinutes: detail.runtime ?? null,
      genres: detail.genres.map((g) => g.id),
      keywords: [],
      castTop: [],
      directors: [],
      voteAverage: detail.vote_average ?? null,
      voteCount: detail.vote_count ?? null,
      popularity: detail.popularity ?? null,
      fetchedAt: new Date(),
    };
    const [persisted] = await db
      .insert(titles)
      .values(row)
      .onConflictDoUpdate({
        target: titles.id,
        set: { ...row, fetchedAt: new Date() },
      })
      .returning();
    return persisted;
  }

  const detail = await getTvDetail(input.tmdbId);
  const row = {
    id,
    tmdbId: detail.id,
    mediaType: "tv" as const,
    title: detail.name,
    year: yearFromDate(detail.first_air_date),
    posterPath: detail.poster_path,
    overview: detail.overview ?? null,
    runtimeMinutes: detail.episode_run_time?.[0] ?? null,
    genres: detail.genres.map((g) => g.id),
    keywords: [],
    castTop: [],
    directors: [],
    voteAverage: detail.vote_average ?? null,
    voteCount: detail.vote_count ?? null,
    popularity: detail.popularity ?? null,
    fetchedAt: new Date(),
  };
  const [persisted] = await db
    .insert(titles)
    .values(row)
    .onConflictDoUpdate({
      target: titles.id,
      set: { ...row, fetchedAt: new Date() },
    })
    .returning();
  return persisted;
}

export async function ensureAvailabilityForTitle(input: {
  title: Title;
  region: RegionCode;
}): Promise<void> {
  const provider = new TmdbAvailabilityProvider();
  await provider.getProviders({
    titleId: input.title.id,
    tmdbId: input.title.tmdbId,
    mediaType: input.title.mediaType,
    region: input.region,
  });
}

export async function getTitleById(id: string): Promise<Title | null> {
  const db = getDb();
  const rows = await db.select().from(titles).where(eq(titles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function setRuntimeIfMissing(
  titleId: string,
  runtime: number
): Promise<void> {
  const db = getDb();
  await db
    .update(titles)
    .set({ runtimeMinutes: runtime })
    .where(and(eq(titles.id, titleId), isNull(titles.runtimeMinutes)));
}
