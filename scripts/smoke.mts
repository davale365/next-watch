import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const TMDB = "https://api.themoviedb.org/3";
const token = process.env.TMDB_API_READ_TOKEN;
const dbUrl = process.env.DATABASE_URL;

if (!token) throw new Error("TMDB_API_READ_TOKEN missing");
if (!dbUrl) throw new Error("DATABASE_URL missing");

async function tmdb(path: string, params: Record<string, string>) {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return res.json() as Promise<{
    results: { id: number; media_type: string; title?: string; name?: string }[];
  }>;
}

async function main() {
  console.log("\n--- TMDB direct search: 'severance' ---");
  const exact = await tmdb("/search/multi", { query: "severance" });
  for (const r of exact.results.slice(0, 3))
    console.log(" ", r.media_type, r.id, r.title || r.name);

  console.log("\n--- TMDB direct search: 'severence' (typo) ---");
  const typo = await tmdb("/search/multi", { query: "severence" });
  console.log(" ", typo.results.length, "results");
  for (const r of typo.results.slice(0, 3))
    console.log(" ", r.media_type, r.id, r.title || r.name);

  console.log("\n--- Fuzzy variants for 'severence' ---");
  const { generateVariants } = await import("../src/lib/search/fuzzy.js");
  const variants = generateVariants("severence", 8);
  console.log(" ", variants);

  console.log("\n--- Searching variants in parallel ---");
  const settled = await Promise.allSettled(
    variants.map((v) => tmdb("/search/multi", { query: v }))
  );
  const ids = new Set<string>();
  for (const r of settled) {
    if (r.status === "fulfilled") {
      for (const item of r.value.results) {
        if (item.media_type === "movie" || item.media_type === "tv") {
          ids.add(`${item.media_type}:${item.id} ${item.title || item.name}`);
        }
      }
    }
  }
  console.log(" ", Array.from(ids).slice(0, 8));
  console.log(
    "  -> Severance (95396) found:",
    Array.from(ids).some((s) => s.includes("95396"))
  );

  console.log("\n--- Neon connectivity ---");
  const sql = neon(dbUrl!);
  const tables = (await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`) as {
    table_name: string;
  }[];
  console.log(" ", tables.map((t) => t.table_name).join(", "));

  const usersCount = (await sql`SELECT count(*)::int AS c FROM users`) as {
    c: number;
  }[];
  const titlesCount = (await sql`SELECT count(*)::int AS c FROM titles`) as {
    c: number;
  }[];
  const availabilityCount = (await sql`SELECT count(*)::int AS c FROM availability`) as {
    c: number;
  }[];
  const reactionsCount = (await sql`SELECT count(*)::int AS c FROM reactions`) as {
    c: number;
  }[];
  console.log("  users:", usersCount[0].c);
  console.log("  titles:", titlesCount[0].c);
  console.log("  availability:", availabilityCount[0].c);
  console.log("  reactions:", reactionsCount[0].c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
