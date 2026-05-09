import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { titles } from "@/db/schema";
import { getCredits, getKeywords } from "@/lib/tmdb/endpoints";
import type {
  TmdbKeywordEntry,
  TmdbMediaType,
  TmdbMovieKeywordsResponse,
  TmdbTvKeywordsResponse,
} from "@/lib/tmdb/types";

const TOP_CAST = 5;
const TOP_DIRECTORS = 2;
const TOP_KEYWORDS = 8;

function extractKeywords(
  resp: TmdbMovieKeywordsResponse | TmdbTvKeywordsResponse | null
): TmdbKeywordEntry[] {
  if (!resp) return [];
  if ("keywords" in resp && Array.isArray(resp.keywords)) {
    return resp.keywords.slice(0, TOP_KEYWORDS);
  }
  if ("results" in resp && Array.isArray(resp.results)) {
    return resp.results.slice(0, TOP_KEYWORDS);
  }
  return [];
}

export async function enrichTitle(input: {
  titleId: string;
  mediaType: TmdbMediaType;
  tmdbId: number;
}): Promise<void> {
  const [credits, keywordsResp] = await Promise.all([
    getCredits(input.mediaType, input.tmdbId).catch(() => null),
    getKeywords(input.mediaType, input.tmdbId).catch(() => null),
  ]);

  const cast = credits?.cast
    ? [...credits.cast]
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
        .slice(0, TOP_CAST)
    : [];
  const directors = credits?.crew
    ? credits.crew
        .filter((c) => c.job === "Director")
        .slice(0, TOP_DIRECTORS)
    : [];
  const keywords = extractKeywords(keywordsResp);

  if (cast.length === 0 && directors.length === 0 && keywords.length === 0) {
    return;
  }

  const db = getDb();
  await db
    .update(titles)
    .set({
      castTop: cast.map((c) => c.id),
      castTopNames: cast.map((c) => c.name),
      directors: directors.map((d) => d.id),
      directorsNames: directors.map((d) => d.name),
      keywords: keywords.map((k) => k.id),
    })
    .where(eq(titles.id, input.titleId));
}

export async function maybeEnrichTitle(input: {
  titleId: string;
  mediaType: TmdbMediaType;
  tmdbId: number;
}): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({
      castTop: titles.castTop,
      directors: titles.directors,
      keywords: titles.keywords,
    })
    .from(titles)
    .where(eq(titles.id, input.titleId))
    .limit(1);
  if (rows.length === 0) return false;
  const r = rows[0];
  if (
    r.castTop.length > 0 ||
    r.directors.length > 0 ||
    r.keywords.length > 0
  ) {
    return false;
  }
  try {
    await enrichTitle(input);
    return true;
  } catch {
    return false;
  }
}
