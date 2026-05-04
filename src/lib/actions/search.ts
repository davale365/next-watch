"use server";

import { z } from "zod";
import { searchMulti } from "@/lib/tmdb/endpoints";
import type { TmdbSearchResult } from "@/lib/tmdb/types";
import { generateVariants } from "@/lib/search/fuzzy";

export interface TitleSearchHit {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  posterPath: string | null;
  popularity: number;
}

const inputSchema = z.object({
  query: z.string().trim().min(2).max(120),
});

const MIN_RESULTS_BEFORE_FALLBACK = 3;
const MAX_VARIANTS = 4;

function yearFromDate(date: string | undefined): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function isMovieOrTv(
  r: TmdbSearchResult
): r is Extract<TmdbSearchResult, { media_type: "movie" | "tv" }> {
  return r.media_type === "movie" || r.media_type === "tv";
}

function toHit(
  r: Extract<TmdbSearchResult, { media_type: "movie" | "tv" }>
): TitleSearchHit {
  if (r.media_type === "movie") {
    return {
      id: `movie:${r.id}`,
      tmdbId: r.id,
      mediaType: "movie",
      title: r.title,
      year: yearFromDate(r.release_date),
      posterPath: r.poster_path,
      popularity: r.popularity,
    };
  }
  return {
    id: `tv:${r.id}`,
    tmdbId: r.id,
    mediaType: "tv",
    title: r.name,
    year: yearFromDate(r.first_air_date),
    posterPath: r.poster_path,
    popularity: r.popularity,
  };
}

export async function searchTitles(input: {
  query: string;
}): Promise<TitleSearchHit[]> {
  const { query } = inputSchema.parse(input);

  const primary = await searchMulti(query);
  const primaryHits = primary.results.filter(isMovieOrTv).map(toHit);

  if (primaryHits.length >= MIN_RESULTS_BEFORE_FALLBACK) {
    return rankAndDedupe(primaryHits);
  }

  const variants = generateVariants(query, MAX_VARIANTS);
  if (variants.length === 0) {
    return rankAndDedupe(primaryHits);
  }

  const settled = await Promise.allSettled(
    variants.map((v) => searchMulti(v))
  );
  const variantHits: TitleSearchHit[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      for (const item of r.value.results) {
        if (isMovieOrTv(item)) variantHits.push(toHit(item));
      }
    }
  }
  return rankAndDedupe([...primaryHits, ...variantHits]);
}

function rankAndDedupe(hits: TitleSearchHit[]): TitleSearchHit[] {
  const byId = new Map<string, TitleSearchHit>();
  for (const h of hits) {
    const existing = byId.get(h.id);
    if (!existing || existing.popularity < h.popularity) {
      byId.set(h.id, h);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 12);
}
