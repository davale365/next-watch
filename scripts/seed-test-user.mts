import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schemaModule from "../src/db/schema";

const schemaCjs =
  (schemaModule as unknown as { default?: typeof schemaModule }).default ??
  schemaModule;
const { users, titles, reactions } = schemaCjs;

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const TMDB = "https://api.themoviedb.org/3";
const token = process.env.TMDB_API_READ_TOKEN!;

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

interface UpsertSeed {
  mediaType: "movie" | "tv";
  tmdbId: number;
  reaction: "binged" | "liked" | "watched" | "dropped" | "not_for_me";
}

const SEED_TITLES: UpsertSeed[] = [
  { mediaType: "tv", tmdbId: 95396, reaction: "binged" },
  { mediaType: "tv", tmdbId: 70523, reaction: "binged" },
  { mediaType: "tv", tmdbId: 71712, reaction: "liked" },
  { mediaType: "movie", tmdbId: 27205, reaction: "liked" },
  { mediaType: "movie", tmdbId: 157336, reaction: "binged" },
];

async function upsertTitleRow(seed: UpsertSeed) {
  const id = `${seed.mediaType}:${seed.tmdbId}`;
  if (seed.mediaType === "movie") {
    const d = (await tmdb(`/movie/${seed.tmdbId}`, { language: "en-GB" })) as {
      id: number;
      title: string;
      release_date: string;
      poster_path: string | null;
      overview: string;
      runtime: number | null;
      genres: { id: number }[];
      vote_average: number;
      vote_count: number;
      popularity: number;
    };
    const row = {
      id,
      tmdbId: d.id,
      mediaType: "movie" as const,
      title: d.title,
      year: Number(d.release_date.slice(0, 4)) || null,
      posterPath: d.poster_path,
      overview: d.overview,
      runtimeMinutes: d.runtime,
      genres: d.genres.map((g) => g.id),
      keywords: [],
      castTop: [],
      directors: [],
      voteAverage: d.vote_average,
      voteCount: d.vote_count,
      popularity: d.popularity,
      fetchedAt: new Date(),
    };
    await db.insert(titles).values(row).onConflictDoUpdate({ target: titles.id, set: row });
  } else {
    const d = (await tmdb(`/tv/${seed.tmdbId}`, { language: "en-GB" })) as {
      id: number;
      name: string;
      first_air_date: string;
      poster_path: string | null;
      overview: string;
      episode_run_time: number[];
      genres: { id: number }[];
      vote_average: number;
      vote_count: number;
      popularity: number;
    };
    const row = {
      id,
      tmdbId: d.id,
      mediaType: "tv" as const,
      title: d.name,
      year: Number(d.first_air_date.slice(0, 4)) || null,
      posterPath: d.poster_path,
      overview: d.overview,
      runtimeMinutes: d.episode_run_time?.[0] ?? null,
      genres: d.genres.map((g) => g.id),
      keywords: [],
      castTop: [],
      directors: [],
      voteAverage: d.vote_average,
      voteCount: d.vote_count,
      popularity: d.popularity,
      fetchedAt: new Date(),
    };
    await db.insert(titles).values(row).onConflictDoUpdate({ target: titles.id, set: row });
  }
  return id;
}

async function main() {
  console.log("Seeding test user with 5 reactions across drama/sci-fi/thriller...");
  const [user] = await db
    .insert(users)
    .values({ region: "GB", selectedPlatforms: [8, 337, 350, 39, 9, 531] })
    .returning();
  console.log("user.id =", user.id);

  for (const seed of SEED_TITLES) {
    const id = await upsertTitleRow(seed);
    await db
      .insert(reactions)
      .values({ userId: user.id, titleId: id, reaction: seed.reaction })
      .onConflictDoUpdate({
        target: [reactions.userId, reactions.titleId],
        set: { reaction: seed.reaction },
      });
    console.log("  +", id, seed.reaction);
  }

  const reactionCount = await db
    .select()
    .from(reactions)
    .where(eq(reactions.userId, user.id));
  console.log("reactions in DB:", reactionCount.length);

  console.log("\nNext: curl with cookie 'next-watch-uid=" + user.id + "'");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
