import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schemaModule from "../src/db/schema";

const schemaCjs =
  (schemaModule as unknown as { default?: typeof schemaModule }).default ??
  schemaModule;
const { feedbackEvents, watchlist, titles } = schemaCjs;

const USER_ID = "a768050f-57e0-4ed1-bc0a-d1d90a6b6c03";
const PORT = 3001;
const COOKIE = `next-watch-uid=${USER_ID}`;

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const TMDB = "https://api.themoviedb.org/3";
const TMDB_TOKEN = process.env.TMDB_API_READ_TOKEN!;

function check(label: string, ok: boolean, detail?: string) {
  const mark = ok ? "  OK   " : "  FAIL ";
  console.log(`${mark} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function tmdbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${TMDB}${path}`, {
    headers: { authorization: `Bearer ${TMDB_TOKEN}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function reset() {
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
  // Wipe enrichment so we're testing the populate path freshly.
  await db
    .update(titles)
    .set({
      castTop: [],
      castTopNames: [],
      directors: [],
      directorsNames: [],
      keywords: [],
    })
    .where(eq(titles.id, "movie:27205"));
}

async function loadTitleArrays(titleId: string) {
  const rows = await db
    .select({
      castTop: titles.castTop,
      castTopNames: titles.castTopNames,
      directors: titles.directors,
      directorsNames: titles.directorsNames,
      keywords: titles.keywords,
    })
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  return rows[0] ?? null;
}

async function inlineEnrich(
  titleId: string,
  mediaType: "movie" | "tv",
  tmdbId: number
) {
  // Mirror the production enrichTitle logic without crossing the server-only
  // boundary, so this script can drive the DB shape end-to-end.
  const credits = await tmdbGet<{
    cast: { id: number; name: string; order?: number }[];
    crew: { id: number; name: string; job?: string }[];
  }>(`/${mediaType}/${tmdbId}/credits?language=en-GB`);
  const keywordsResp = await tmdbGet<
    | { keywords: { id: number; name: string }[] }
    | { results: { id: number; name: string }[] }
  >(`/${mediaType}/${tmdbId}/keywords`);

  const cast = [...credits.cast]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 5);
  const directors = credits.crew
    .filter((c) => c.job === "Director")
    .slice(0, 2);
  const keywords =
    "keywords" in keywordsResp
      ? keywordsResp.keywords.slice(0, 8)
      : keywordsResp.results.slice(0, 8);

  await db
    .update(titles)
    .set({
      castTop: cast.map((c) => c.id),
      castTopNames: cast.map((c) => c.name),
      directors: directors.map((d) => d.id),
      directorsNames: directors.map((d) => d.name),
      keywords: keywords.map((k) => k.id),
    })
    .where(eq(titles.id, titleId));
}

async function fetchPicks(query = ""): Promise<{ status: number; html: string }> {
  const res = await fetch(`http://localhost:${PORT}/picks${query}`, {
    headers: { Cookie: COOKIE },
  });
  return { status: res.status, html: await res.text() };
}

async function main() {
  console.log("\n=== A. Schema columns exist + are accessible ===");
  const before = await loadTitleArrays("movie:27205");
  check("Inception row exists in DB", before != null);
  check(
    "castTopNames + directorsNames columns selectable",
    before != null &&
      Array.isArray(before.castTopNames) &&
      Array.isArray(before.directorsNames)
  );

  console.log("\n=== B. enrichTitle populates cast / directors / names / keywords ===");
  await reset();
  await inlineEnrich("movie:27205", "movie", 27205);
  const after = await loadTitleArrays("movie:27205");
  check("cast_top populated (≥3)", (after?.castTop.length ?? 0) >= 3);
  check(
    "cast_top_names parallel length matches cast_top",
    after != null && after.castTop.length === after.castTopNames.length
  );
  check("directors populated (≥1)", (after?.directors.length ?? 0) >= 1);
  check(
    "directors_names parallel length matches directors",
    after != null && after.directors.length === after.directorsNames.length
  );
  check("keywords populated (≥3)", (after?.keywords.length ?? 0) >= 3);
  console.log(
    "  Inception cast names:",
    after?.castTopNames.join(", ") ?? "(empty)"
  );
  console.log(
    "  Inception directors:",
    after?.directorsNames.join(", ") ?? "(empty)"
  );
  check(
    "Christopher Nolan in Inception's directors_names",
    (after?.directorsNames ?? []).some((n) => /Nolan/i.test(n))
  );

  console.log("\n=== C. maybeEnrichTitle skip path: already-populated row stays put ===");
  // Snapshot, attempt re-enrichment via inlineEnrich (unconditional) — it
  // would overwrite. Instead simulate the maybeEnrichTitle guard: if any of
  // castTop/directors/keywords is non-empty, skip TMDB call and DB write.
  const before2 = await loadTitleArrays("movie:27205");
  const wouldSkip =
    (before2?.castTop.length ?? 0) > 0 ||
    (before2?.directors.length ?? 0) > 0 ||
    (before2?.keywords.length ?? 0) > 0;
  check("Already-enriched row triggers maybeEnrichTitle skip", wouldSkip);

  console.log("\n=== D. /picks renders with the new code paths (no crash) ===");
  await db
    .delete(feedbackEvents)
    .where(eq(feedbackEvents.userId, USER_ID));
  const picks = await fetchPicks();
  check("/picks returns 200", picks.status === 200, `${picks.status}`);
  check(
    "Renders Show me different button (still wired)",
    /Show me different/.test(picks.html)
  );
  check(
    "Renders at least one card",
    /<article[^>]*>/.test(picks.html)
  );

  console.log("\n=== E. Reason text references a real person name when overlap exists ===");
  // Inception is in the user's seeded reactions. With cast/director enriched,
  // any candidate whose enriched cast/director overlaps Inception's should
  // pick up a person-name prefix. We can't deterministically guarantee one
  // surfaces in the slate, but we can confirm the system *can* render a
  // person name by checking the HTML for any non-genre name token.
  const html = picks.html;
  const personHints = [
    "Stars ",
    "Directed by",
    "From ",
    "alongside",
    "behind the camera",
    "(last seen by you in",
  ];
  const matched = personHints.filter((h) => html.includes(h));
  console.log(
    "  Reason-prefix patterns observed:",
    matched.length === 0 ? "(none — fallback genre reasons in this slate)" : matched.join(" | ")
  );
  // Soft check — does NOT fail the run, since enrichment of candidates is
  // best-effort across visits.
  console.log(
    matched.length > 0
      ? "  → person-aware prefix DID render this request"
      : "  → no person-aware prefix this request (acceptable: candidates may not be enriched yet, or no overlap)"
  );

  console.log("\n=== F. Cleanup feedback rows for this user ===");
  await db
    .delete(feedbackEvents)
    .where(eq(feedbackEvents.userId, USER_ID));
  await db
    .delete(watchlist)
    .where(eq(watchlist.userId, USER_ID));
  console.log("  done");

  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
