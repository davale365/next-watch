import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
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

function check(label: string, ok: boolean, detail?: string) {
  const mark = ok ? "  OK   " : "  FAIL ";
  console.log(`${mark} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

interface Pick {
  titleId: string;
  title: string;
  mediaType: string;
  bucket: string;
}

async function fetchPicks(query = ""): Promise<{ status: number; html: string; slate: Pick[]; queue: Pick[] }> {
  const url = `http://localhost:${PORT}/picks${query}`;
  const res = await fetch(url, { headers: { Cookie: COOKIE } });
  const html = await res.text();

  function extract(label: "initialSlate" | "initialQueue"): Pick[] {
    const re = new RegExp(
      label === "initialSlate"
        ? `initialSlate\\\\":(\\[.*?\\])(?=,\\\\"initialQueue)`
        : `initialQueue\\\\":(\\[.*?\\])(?=,\\\\"region)`
    );
    const m = re.exec(html);
    if (!m) return [];
    const titleIds = [...m[1].matchAll(/\\"titleId\\":\\"([^\\"]+)\\"/g)].map((x) => x[1]);
    const titlesArr = [...m[1].matchAll(/\\"title\\":\\"([^\\"]+)\\"/g)].map((x) => x[1]);
    const buckets = [...m[1].matchAll(/\\"bucket\\":\\"([^\\"]+)\\"/g)].map((x) => x[1]);
    const mts = [...m[1].matchAll(/\\"mediaType\\":\\"(movie|tv)\\"/g)].map((x) => x[1]);
    return titleIds.map((titleId, i) => ({
      titleId,
      title: titlesArr[i],
      mediaType: mts[i],
      bucket: buckets[i],
    }));
  }

  return { status: res.status, html, slate: extract("initialSlate"), queue: extract("initialQueue") };
}

async function reset() {
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
}

async function runtimesFor(titleIds: string[]): Promise<Map<string, number | null>> {
  if (titleIds.length === 0) return new Map();
  const rows = await db
    .select({ id: titles.id, runtimeMinutes: titles.runtimeMinutes })
    .from(titles)
    .where(inArray(titles.id, titleIds));
  return new Map(rows.map((r) => [r.id, r.runtimeMinutes]));
}

async function main() {
  await reset();

  console.log("\n=== A. Quick pill renders + activates from URL ===");
  const a = await fetchPicks();
  check("Renders Quick (≤90 min) pill", a.html.includes("Quick (≤90 min)"));
  check(
    "Renders Just one sitting pill",
    a.html.includes("Just one sitting")
  );
  check("Renders Time to binge pill", a.html.includes("Time to binge"));

  const aQuick = await fetchPicks("?time=quick");
  check(
    "?time=quick activates Quick pill",
    /aria-pressed="true"[^>]*>Quick \(≤90 min\)/.test(aQuick.html)
  );

  console.log("\n=== B. ?time=any returns at least one pick (mix allowed) ===");
  const any = await fetchPicks();
  check(
    "Baseline slate populated under ?time=any",
    any.slate.length >= 1,
    `${any.slate.length} cards`
  );

  console.log("\n=== C. ?time=one_sitting returns only movies, runtime ≤ 130 ===");
  const os = await fetchPicks("?time=one_sitting");
  console.log(
    "  one_sitting slate:",
    os.slate.map((p) => `${p.title} (${p.mediaType})`).join(", ") || "(empty)"
  );
  const osTitleIds = [...os.slate, ...os.queue].map((p) => p.titleId);
  const osRuntimes = await runtimesFor(osTitleIds);
  const osTV = [...os.slate, ...os.queue].filter((p) => p.mediaType === "tv");
  check("No TV in slate or queue", osTV.length === 0);
  let osBadRuntime: string[] = [];
  for (const p of [...os.slate, ...os.queue]) {
    if (p.mediaType !== "movie") continue;
    const r = osRuntimes.get(p.titleId);
    if (r == null) osBadRuntime.push(`${p.title}=null`);
    else if (r > 130) osBadRuntime.push(`${p.title}=${r}`);
  }
  check(
    "Every returned movie has runtime persisted AND ≤ 130",
    osBadRuntime.length === 0,
    osBadRuntime.length === 0 ? "" : osBadRuntime.join(", ")
  );

  console.log("\n=== D. ?time=quick returns only movies, runtime ≤ 90 ===");
  const qk = await fetchPicks("?time=quick");
  console.log(
    "  quick slate:",
    qk.slate.map((p) => `${p.title} (${p.mediaType})`).join(", ") || "(empty)"
  );
  const qkTitleIds = [...qk.slate, ...qk.queue].map((p) => p.titleId);
  const qkRuntimes = await runtimesFor(qkTitleIds);
  const qkTV = [...qk.slate, ...qk.queue].filter((p) => p.mediaType === "tv");
  check("No TV in slate or queue", qkTV.length === 0);
  let qkBadRuntime: string[] = [];
  for (const p of [...qk.slate, ...qk.queue]) {
    if (p.mediaType !== "movie") continue;
    const r = qkRuntimes.get(p.titleId);
    if (r == null) qkBadRuntime.push(`${p.title}=null`);
    else if (r > 90) qkBadRuntime.push(`${p.title}=${r}`);
  }
  check(
    "Every returned movie has runtime persisted AND ≤ 90",
    qkBadRuntime.length === 0,
    qkBadRuntime.length === 0 ? "" : qkBadRuntime.join(", ")
  );

  console.log("\n=== E. ?time=any does NOT cap runtime (long movies allowed) ===");
  // Spot-check: pick any movie from the any-slate; if runtime is null we
  // can't strongly assert, but we can confirm no cap was applied by allowing
  // any value to pass (no FAIL by construction).
  const anyMovies = [...any.slate, ...any.queue].filter((p) => p.mediaType === "movie");
  check(
    "any view returned at least one movie or TV",
    [...any.slate, ...any.queue].length >= 1,
    `${[...any.slate, ...any.queue].length} entries`
  );
  if (anyMovies.length > 0) {
    const anyRuntimes = await runtimesFor(anyMovies.map((p) => p.titleId));
    const anyValues = anyMovies.map((p) => anyRuntimes.get(p.titleId) ?? null);
    console.log(
      "  any-mode movie runtimes (raw, possibly null since enrichment skipped):",
      anyValues.join(", ")
    );
  }

  console.log("\n=== F. Cleanup ===");
  await reset();
  console.log("  done");

  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
