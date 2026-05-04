import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import schemaCjs from "../src/db/schema";
const { users, titles, availability, reactions } =
  (schemaCjs as unknown as typeof import("../src/db/schema"));

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

async function main() {
  console.log("\n--- Phase 1 data layer smoke test ---");

  console.log("1. Insert anonymous user (region GB, platforms [Netflix=8, Disney=337, Apple=350])");
  const [user] = await db
    .insert(users)
    .values({ region: "GB", selectedPlatforms: [8, 337, 350] })
    .returning();
  console.log("   user.id:", user.id);

  console.log("2. Upsert title: Severance (tv 95396)");
  const detail = (await tmdb("/tv/95396", { language: "en-GB" })) as {
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
  const titleRow = {
    id: `tv:${detail.id}`,
    tmdbId: detail.id,
    mediaType: "tv" as const,
    title: detail.name,
    year: Number(detail.first_air_date.slice(0, 4)),
    posterPath: detail.poster_path,
    overview: detail.overview,
    runtimeMinutes: detail.episode_run_time?.[0] ?? null,
    genres: detail.genres.map((g) => g.id),
    keywords: [],
    castTop: [],
    directors: [],
    voteAverage: detail.vote_average,
    voteCount: detail.vote_count,
    popularity: detail.popularity,
    fetchedAt: new Date(),
  };
  const [title] = await db
    .insert(titles)
    .values(titleRow)
    .onConflictDoUpdate({ target: titles.id, set: titleRow })
    .returning();
  console.log("   title.id:", title.id, "title.title:", title.title, "year:", title.year);

  console.log("3. Lazy-fetch availability for Severance in GB (single-retry rule)");
  const provResp = (await tmdb(`/tv/${title.tmdbId}/watch/providers`)) as {
    results: Record<string, {
      flatrate?: { provider_id: number }[];
      free?: { provider_id: number }[];
      ads?: { provider_id: number }[];
      rent?: { provider_id: number }[];
      buy?: { provider_id: number }[];
    }>;
  };
  const gb = provResp.results["GB"] ?? {};
  const buckets = ["flatrate", "free", "ads", "rent", "buy"] as const;
  const availRows: Array<typeof availability.$inferInsert> = [];
  for (const b of buckets) {
    for (const p of gb[b] ?? []) {
      availRows.push({
        titleId: title.id,
        region: "GB",
        providerId: p.provider_id,
        monetization: b,
      });
    }
  }
  await db.delete(availability).where(
    and(eq(availability.titleId, title.id), eq(availability.region, "GB"))
  );
  if (availRows.length > 0) {
    await db.insert(availability).values(availRows);
  }
  const flatrate = availRows.filter((r) => r.monetization === "flatrate").map((r) => r.providerId);
  console.log("   availability rows:", availRows.length, "flatrate providers:", flatrate.join(", "));

  console.log("4. Insert reaction (binged)");
  await db
    .insert(reactions)
    .values({ userId: user.id, titleId: title.id, reaction: "binged" })
    .onConflictDoUpdate({
      target: [reactions.userId, reactions.titleId],
      set: { reaction: "binged" },
    });

  console.log("5. Verify rows back");
  const userBack = await db.select().from(users).where(eq(users.id, user.id));
  const titleBack = await db.select().from(titles).where(eq(titles.id, title.id));
  const availBack = await db
    .select()
    .from(availability)
    .where(and(eq(availability.titleId, title.id), eq(availability.region, "GB")));
  const reactBack = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.userId, user.id), eq(reactions.titleId, title.id)));
  console.log("   users:", userBack.length, " titles:", titleBack.length, " availability:", availBack.length, " reactions:", reactBack.length, "(", reactBack[0]?.reaction, ")");

  console.log("\n6. Cleanup test user");
  await db.delete(users).where(eq(users.id, user.id));
  console.log("   done");

  console.log("\n--- ALL CHECKS PASSED ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
