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

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

interface Pick {
  titleId: string;
  title: string;
  bucket: string;
  confidence: number;
}

async function getPicks(query = ""): Promise<{ slate: Pick[]; queue: Pick[] }> {
  const url = `http://localhost:${PORT}/picks${query}`;
  const res = await fetch(url, {
    headers: { Cookie: `next-watch-uid=${USER_ID}` },
  });
  const html = await res.text();

  function extract(label: "initialSlate" | "initialQueue") {
    const re = new RegExp(
      label === "initialSlate"
        ? `initialSlate\\\\":(\\[.*?\\])(?=,\\\\"initialQueue)`
        : `initialQueue\\\\":(\\[.*?\\])(?=,\\\\"region)`
    );
    const m = re.exec(html);
    if (!m) return [];
    const titleIds = [...m[1].matchAll(/\\"titleId\\":\\"([^\\"]+)\\"/g)].map(
      (x) => x[1]
    );
    const titlesArr = [...m[1].matchAll(/\\"title\\":\\"([^\\"]+)\\"/g)].map(
      (x) => x[1]
    );
    const buckets = [...m[1].matchAll(/\\"bucket\\":\\"([^\\"]+)\\"/g)].map(
      (x) => x[1]
    );
    const confs = [...m[1].matchAll(/\\"confidence\\":(\d+)/g)].map((x) =>
      Number(x[1])
    );
    return titleIds.map((titleId, i) => ({
      titleId,
      title: titlesArr[i],
      bucket: buckets[i],
      confidence: confs[i],
    }));
  }

  return { slate: extract("initialSlate"), queue: extract("initialQueue") };
}

function dump(label: string, picks: { slate: Pick[]; queue: Pick[] }) {
  console.log(`\n${label}`);
  console.log("  slate:");
  for (const p of picks.slate)
    console.log(`    [${p.bucket}] ${p.title} (${p.confidence}%) ${p.titleId}`);
  console.log("  queue:");
  for (const p of picks.queue)
    console.log(`    [${p.bucket}] ${p.title} (${p.confidence}%) ${p.titleId}`);
}

async function main() {
  console.log("== STEP 1: clear prior feedback for this user ==");
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
  console.log("  cleared");

  console.log("\n== STEP 2: get baseline picks ==");
  const baseline = await getPicks();
  dump("baseline", baseline);

  if (baseline.slate.length === 0) {
    console.error("baseline returned empty slate — cannot continue");
    process.exit(1);
  }

  console.log("\n== STEP 3: record not_for_me on every visible pick ==");
  for (const p of baseline.slate) {
    await db.insert(feedbackEvents).values({
      userId: USER_ID,
      titleId: p.titleId,
      action: "not_for_me",
      bucket: p.bucket as "safe" | "stretch" | "gem",
      sessionId: "test-session",
    });
    console.log(`  not_for_me: ${p.title} (${p.titleId})`);
  }

  console.log("\n== STEP 4: get picks again, expect (a) those titles excluded, (b) new picks ==");
  const afterNegative = await getPicks();
  dump("after not_for_me", afterNegative);

  const baselineTitleIds = new Set(baseline.slate.map((p) => p.titleId));
  const stillThere = afterNegative.slate.filter((p) =>
    baselineTitleIds.has(p.titleId)
  );
  console.log(
    "  excluded check:",
    stillThere.length === 0
      ? "OK — none of the baseline picks reappeared"
      : `FAIL — ${stillThere.map((p) => p.title).join(", ")} still present`
  );

  console.log("\n== STEP 5: clear, then add 3 watchlist + interested events ==");
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));

  for (const p of baseline.slate.slice(0, 2)) {
    await db.insert(feedbackEvents).values({
      userId: USER_ID,
      titleId: p.titleId,
      action: "watchlist",
      bucket: p.bucket as "safe" | "stretch" | "gem",
      sessionId: "test-session",
    });
    await db
      .insert(watchlist)
      .values({ userId: USER_ID, titleId: p.titleId })
      .onConflictDoNothing();
    console.log(`  watchlist: ${p.title}`);
  }
  if (baseline.slate.length > 2) {
    const p = baseline.slate[2];
    await db.insert(feedbackEvents).values({
      userId: USER_ID,
      titleId: p.titleId,
      action: "interested",
      bucket: p.bucket as "safe" | "stretch" | "gem",
      sessionId: "test-session",
    });
    console.log(`  interested: ${p.title}`);
  }

  console.log("\n== STEP 6: re-fetch — those titles should be excluded too ==");
  const afterPositive = await getPicks();
  dump("after watchlist + interested", afterPositive);
  const stillTherePos = afterPositive.slate.filter((p) =>
    baselineTitleIds.has(p.titleId)
  );
  console.log(
    "  excluded check:",
    stillTherePos.length === 0
      ? "OK — interested/watchlist titles did not reappear"
      : `FAIL — ${stillTherePos.map((p) => p.title).join(", ")} still present`
  );

  console.log("\n== STEP 7: read watchlist back ==");
  const wl = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, USER_ID));
  console.log(`  watchlist rows: ${wl.length}`);
  for (const w of wl)
    console.log(`    ${w.titleId} added ${w.addedAt.toISOString()}`);

  console.log("\n== STEP 8: clean up feedback so the user is fresh again ==");
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
  console.log("  cleaned");

  console.log("\n--- ALL CHECKS DONE ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
