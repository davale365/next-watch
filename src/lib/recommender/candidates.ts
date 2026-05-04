import "server-only";
import {
  discoverByGenres,
  getRecommendations,
  getSimilar,
} from "@/lib/tmdb/endpoints";
import type { TmdbCandidate, TmdbMediaType } from "@/lib/tmdb/types";
import type { Title } from "@/db/schema";
import type { RawCandidate } from "./types";

const CONCURRENCY = 6;
const CANDIDATES_PER_TITLE = 18;
const DISCOVER_PER_GENRE = 18;

function yearFromCandidate(c: TmdbCandidate): number | null {
  const date = c.release_date || c.first_air_date;
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function inferredMediaType(c: TmdbCandidate): TmdbMediaType | null {
  if (c.media_type === "movie" || c.media_type === "tv") return c.media_type;
  if (c.title) return "movie";
  if (c.name) return "tv";
  return null;
}

function toRaw(
  c: TmdbCandidate,
  mediaType: TmdbMediaType,
  source: RawCandidate["source"],
  sourceTitleId?: string
): RawCandidate | null {
  const titleText = c.title || c.name;
  if (!titleText || !c.id) return null;
  return {
    titleId: `${mediaType}:${c.id}`,
    tmdbId: c.id,
    mediaType,
    title: titleText,
    year: yearFromCandidate(c),
    posterPath: c.poster_path,
    overview: c.overview ?? "",
    genreIds: c.genre_ids ?? [],
    voteAverage: c.vote_average ?? 0,
    voteCount: c.vote_count ?? 0,
    popularity: c.popularity ?? 0,
    source,
    sourceTitleId,
  };
}

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

interface GenerateInput {
  positiveTitles: Title[];
  topGenres: number[];
  region: string;
  excludeIds: Set<string>;
}

export async function generateCandidates(
  input: GenerateInput
): Promise<RawCandidate[]> {
  const { positiveTitles, topGenres, region, excludeIds } = input;
  const collected = new Map<string, RawCandidate>();

  const fanout = positiveTitles.flatMap((t) => [
    { kind: "rec" as const, title: t },
    { kind: "sim" as const, title: t },
  ]);

  const tmdbResults = await pMap(
    fanout,
    async ({ kind, title }) => {
      try {
        if (kind === "rec") {
          const r = await getRecommendations(title.mediaType, title.tmdbId);
          return { kind, sourceTitleId: title.id, items: r.results };
        }
        const r = await getSimilar(title.mediaType, title.tmdbId);
        return { kind, sourceTitleId: title.id, items: r.results };
      } catch {
        return { kind, sourceTitleId: title.id, items: [] };
      }
    },
    CONCURRENCY
  );

  for (const r of tmdbResults) {
    const sourceTitle = positiveTitles.find((t) => t.id === r.sourceTitleId);
    if (!sourceTitle) continue;
    const slice = r.items.slice(0, CANDIDATES_PER_TITLE);
    for (const c of slice) {
      const mt = inferredMediaType(c) ?? sourceTitle.mediaType;
      const raw = toRaw(
        c,
        mt,
        r.kind === "rec" ? "recommendations" : "similar",
        r.sourceTitleId
      );
      if (!raw) continue;
      if (excludeIds.has(raw.titleId)) continue;
      const existing = collected.get(raw.titleId);
      if (!existing || existing.popularity < raw.popularity) {
        collected.set(raw.titleId, raw);
      }
    }
  }

  if (topGenres.length > 0) {
    const discoverFanout: { mt: TmdbMediaType; genreIds: number[] }[] = [
      { mt: "movie", genreIds: topGenres.slice(0, 2) },
      { mt: "tv", genreIds: topGenres.slice(0, 2) },
    ];
    const discovered = await pMap(
      discoverFanout,
      async ({ mt, genreIds }) => {
        try {
          const r = await discoverByGenres({
            mediaType: mt,
            genreIds,
            region,
            voteCountGte: 200,
          });
          return { mt, items: r.results };
        } catch {
          return { mt, items: [] };
        }
      },
      2
    );
    for (const d of discovered) {
      for (const c of d.items.slice(0, DISCOVER_PER_GENRE)) {
        const raw = toRaw(c, d.mt, "discover");
        if (!raw) continue;
        if (excludeIds.has(raw.titleId)) continue;
        if (collected.has(raw.titleId)) continue;
        collected.set(raw.titleId, raw);
      }
    }
  }

  return Array.from(collected.values());
}
