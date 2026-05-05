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

async function fetchPath(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    headers: { Cookie: COOKIE },
  });
  return { status: res.status, html: await res.text() };
}

function check(label: string, ok: boolean, detail?: string) {
  const mark = ok ? "  OK   " : "  FAIL ";
  console.log(`${mark} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

function countMatches(html: string, re: RegExp): number {
  const m = html.match(re);
  return m ? m.length : 0;
}

async function main() {
  console.log("\n=== Reset feedback + watchlist for the seeded user ===");
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));

  console.log("\n=== TopNav presence on every page ===");
  for (const path of ["/", "/picks", "/watchlist"]) {
    const r = await fetchPath(path);
    check(`${path} returns 200`, r.status === 200, `${r.status}`);
    check(
      `${path} renders TopNav with all 3 links`,
      r.html.includes('href="/"') &&
        r.html.includes('href="/picks"') &&
        r.html.includes('href="/watchlist"')
    );
  }

  console.log("\n=== Watchlist empty state ===");
  const empty = await fetchPath("/watchlist");
  check(
    "Empty copy present",
    empty.html.includes(
      "Your watchlist is empty. Add titles from your picks."
    )
  );
  check(
    "CTA to /picks present",
    empty.html.includes(">Go to picks</a>") ||
      empty.html.includes("Go to picks")
  );
  check(
    "No watchlist cards rendered",
    countMatches(empty.html, /aspect-\[2\/3\]/g) === 0
  );

  console.log("\n=== Populate watchlist via watchlist + interested events ===");
  const seedTitles = [
    { titleId: "tv:1622", title: "Supernatural" },
    { titleId: "movie:11324", title: "Shutter Island" },
    { titleId: "tv:1405", title: "Dexter" },
  ];
  for (const t of seedTitles) {
    await db.insert(feedbackEvents).values({
      userId: USER_ID,
      titleId: t.titleId,
      action: "watchlist",
      bucket: "safe",
      sessionId: "phase5-test",
    });
    await db
      .insert(watchlist)
      .values({ userId: USER_ID, titleId: t.titleId })
      .onConflictDoNothing();
  }
  const wl = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, USER_ID));
  check(
    `Watchlist now has ${seedTitles.length} rows`,
    wl.length === seedTitles.length,
    `actual=${wl.length}`
  );

  console.log("\n=== /watchlist renders the saved titles ===");
  const filled = await fetchPath("/watchlist");
  check("Returns 200", filled.status === 200);
  for (const t of seedTitles) {
    check(`Renders "${t.title}"`, filled.html.includes(t.title));
  }
  check(
    "Empty copy is no longer shown",
    !filled.html.includes(
      "Your watchlist is empty. Add titles from your picks."
    )
  );
  check(
    "Header shows count",
    filled.html.includes(`${seedTitles.length} titles saved.`)
  );
  check(
    "Newest-first order — first poster section comes before last title",
    filled.html.indexOf(seedTitles[2].title) <
      filled.html.indexOf(seedTitles[0].title)
  );

  console.log("\n=== /picks excludes watchlisted titles ===");
  const picks = await fetchPath("/picks");
  check("Returns 200", picks.status === 200);
  for (const t of seedTitles) {
    const idx = picks.html.indexOf(`>${t.title}</h3>`);
    check(`"${t.title}" NOT in slate cards`, idx === -1);
  }

  console.log("\n=== Cleanup ===");
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
  console.log("  done");

  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
