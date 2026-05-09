import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schemaModule from "../src/db/schema";

const schemaCjs =
  (schemaModule as unknown as { default?: typeof schemaModule }).default ??
  schemaModule;
const { feedbackEvents, watchlist } = schemaCjs;

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
  bucket: string;
  confidence: number;
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
    const confs = [...m[1].matchAll(/\\"confidence\\":(\d+)/g)].map((x) => Number(x[1]));
    return titleIds.map((titleId, i) => ({ titleId, title: titlesArr[i], bucket: buckets[i], confidence: confs[i] }));
  }

  return { status: res.status, html, slate: extract("initialSlate"), queue: extract("initialQueue") };
}

async function reset() {
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
}

async function main() {
  await reset();

  console.log("\n=== A. Button label is now 'Show me different' (not 'Refresh picks') ===");
  const a = await fetchPicks();
  check("/picks returns 200", a.status === 200, `${a.status}`);
  check(
    "Renders 'Show me different' button",
    /Show me different/.test(a.html)
  );
  check(
    "Old 'Refresh picks' label gone",
    !/>\s*Refresh picks\s*</.test(a.html)
  );

  console.log("\n=== B. Baseline slate populated ===");
  check(
    "Baseline slate has at least 1 pick",
    a.slate.length >= 1,
    `${a.slate.length} cards`
  );
  if (a.slate.length === 0) return;
  console.log("  baseline slate IDs:", a.slate.map((p) => p.titleId).join(", "));
  console.log("  baseline queue IDs:", a.queue.map((p) => p.titleId).join(", "));

  console.log("\n=== C. Engine excludes given title IDs (same Set used by transientExcludeIds) ===");
  // Exclude ONLY the visible slate via the feedback path — both routes feed into
  // the engine's excludeIds Set. With queue + discover backups still available,
  // the next call should still produce fresh picks.
  const slateIds = new Set(a.slate.map((p) => p.titleId));
  for (const titleId of slateIds) {
    await db.insert(feedbackEvents).values({
      userId: USER_ID,
      titleId,
      action: "not_for_me",
      bucket: "safe",
      sessionId: "milestone2-test",
    });
  }

  const b = await fetchPicks();
  console.log("  after-exclude slate IDs:", b.slate.map((p) => p.titleId).join(", "));
  const overlap = b.slate.filter((p) => slateIds.has(p.titleId));
  check(
    "New slate has zero overlap with the excluded slate",
    overlap.length === 0,
    overlap.length === 0
      ? ""
      : `overlap: ${overlap.map((p) => p.title).join(", ")}`
  );
  check(
    "New slate has at least 1 fresh pick (engine surfaced beyond the excluded set)",
    b.slate.length >= 1,
    `${b.slate.length} cards`
  );

  console.log("\n=== C2. Aggressive exclusion → engine returns thin/empty result honestly ===");
  // Now exclude everything and confirm the engine doesn't lie — it returns
  // either no slate or thin_slate with a banner message, never recycles excluded ids.
  const allIds = new Set([
    ...a.slate.map((p) => p.titleId),
    ...a.queue.map((p) => p.titleId),
  ]);
  for (const titleId of allIds) {
    if (slateIds.has(titleId)) continue;
    await db.insert(feedbackEvents).values({
      userId: USER_ID,
      titleId,
      action: "not_for_me",
      bucket: "safe",
      sessionId: "milestone2-test",
    });
  }
  const c2 = await fetchPicks();
  console.log("  aggressive-exclude slate count:", c2.slate.length);
  const c2Overlap = c2.slate.filter((p) => allIds.has(p.titleId));
  check(
    "Aggressive exclude — zero overlap with excluded set",
    c2Overlap.length === 0,
    c2Overlap.length === 0 ? "" : c2Overlap.map((p) => p.title).join(", ")
  );
  check(
    "Aggressive exclude — slate is empty OR all picks are genuinely fresh",
    c2.slate.length === 0 || c2Overlap.length === 0
  );

  console.log("\n=== D. Action file exists and exports getDifferentPicksAction ===");
  // The build step already validated import resolution. Confirm the file is on disk.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const actionPath = path.resolve("src/lib/actions/picks.ts");
  const exists = fs.existsSync(actionPath);
  check("src/lib/actions/picks.ts exists", exists);
  if (exists) {
    const contents = fs.readFileSync(actionPath, "utf-8");
    check(
      "Exports getDifferentPicksAction",
      /export\s+async\s+function\s+getDifferentPicksAction/.test(contents)
    );
    check(
      "Does NOT write feedback_events",
      !/insert\(\s*feedbackEvents/.test(contents) &&
        !/insert\(feedbackEvents/.test(contents)
    );
  }

  console.log("\n=== E. Cleanup ===");
  await reset();
  console.log("  done");

  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
