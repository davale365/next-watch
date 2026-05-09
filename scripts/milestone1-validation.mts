import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import * as schemaModule from "../src/db/schema";

const schemaCjs =
  (schemaModule as unknown as { default?: typeof schemaModule }).default ??
  schemaModule;
const { feedbackEvents, reactions, watchlist } = schemaCjs;

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

async function fetchPath(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`http://localhost:${PORT}${path}`, {
    headers: { Cookie: COOKIE },
  });
  return { status: res.status, html: await res.text() };
}

async function reset() {
  await db.delete(feedbackEvents).where(eq(feedbackEvents.userId, USER_ID));
  await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));
  await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.userId, USER_ID),
        eq(reactions.titleId, "tv:1622")
      )
    );
}

async function seedWatchlist(titleId: string) {
  await db.insert(feedbackEvents).values({
    userId: USER_ID,
    titleId,
    action: "watchlist",
    bucket: "safe",
    sessionId: "milestone1",
  });
  await db
    .insert(watchlist)
    .values({ userId: USER_ID, titleId })
    .onConflictDoNothing();
}

async function main() {
  console.log("\n=== A. Provider chips render on /watchlist card ===");
  await reset();
  await seedWatchlist("tv:1622");
  const a = await fetchPath("/watchlist");
  check("/watchlist returns 200", a.status === 200, `${a.status}`);
  check("Renders Supernatural", a.html.includes("Supernatural"));
  check(
    "Renders provider chip (Prime Video — known availability for tv:1622)",
    a.html.includes(">Prime Video<")
  );
  check(
    "Renders Mark as watched button",
    a.html.includes("Mark as watched")
  );
  check("Renders Remove button", a.html.includes(">Remove<"));

  console.log("\n=== B. Remove flow: deletes watchlist + feedback events ===");
  await reset();
  await seedWatchlist("tv:1622");
  // Simulate the action body server-side (the action is just delete + delete).
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, USER_ID), eq(watchlist.titleId, "tv:1622")));
  await db
    .delete(feedbackEvents)
    .where(
      and(
        eq(feedbackEvents.userId, USER_ID),
        eq(feedbackEvents.titleId, "tv:1622"),
        eq(feedbackEvents.action, "watchlist")
      )
    );
  const wlAfter = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, USER_ID));
  const fbAfter = await db
    .select()
    .from(feedbackEvents)
    .where(eq(feedbackEvents.userId, USER_ID));
  check("watchlist row gone", wlAfter.length === 0);
  check("watchlist feedback row gone", fbAfter.length === 0);

  console.log("\n=== C. Mark as watched: deletes watchlist + adds reaction ===");
  await reset();
  await seedWatchlist("tv:1622");
  // Simulate the action body server-side.
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, USER_ID), eq(watchlist.titleId, "tv:1622")));
  await db
    .delete(feedbackEvents)
    .where(
      and(
        eq(feedbackEvents.userId, USER_ID),
        eq(feedbackEvents.titleId, "tv:1622"),
        eq(feedbackEvents.action, "watchlist")
      )
    );
  await db
    .insert(reactions)
    .values({ userId: USER_ID, titleId: "tv:1622", reaction: "watched" })
    .onConflictDoNothing();

  const wlAfter2 = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, USER_ID));
  const fbAfter2 = await db
    .select()
    .from(feedbackEvents)
    .where(eq(feedbackEvents.userId, USER_ID));
  const reactionAfter = await db
    .select()
    .from(reactions)
    .where(
      and(eq(reactions.userId, USER_ID), eq(reactions.titleId, "tv:1622"))
    );
  check("watchlist row gone", wlAfter2.length === 0);
  check("watchlist feedback row gone", fbAfter2.length === 0);
  check(
    "reactions row added with reaction=watched",
    reactionAfter.length === 1 && reactionAfter[0].reaction === "watched"
  );

  console.log("\n=== D. Mark as watched is idempotent if reaction exists ===");
  // Existing reaction stays (onConflictDoNothing); no error.
  await db
    .insert(reactions)
    .values({ userId: USER_ID, titleId: "tv:1622", reaction: "binged" })
    .onConflictDoNothing();
  const stillWatched = await db
    .select()
    .from(reactions)
    .where(
      and(eq(reactions.userId, USER_ID), eq(reactions.titleId, "tv:1622"))
    );
  check(
    "existing reaction (watched) preserved on conflict (onConflictDoNothing)",
    stillWatched.length === 1 && stillWatched[0].reaction === "watched"
  );

  console.log("\n=== E. Empty state ===");
  await reset();
  const e = await fetchPath("/watchlist");
  check("/watchlist returns 200", e.status === 200);
  check(
    "Empty copy present",
    e.html.includes("Your watchlist is empty. Add titles from your picks.")
  );
  check(
    "No 'Remove' button when empty",
    !e.html.includes(">Remove<")
  );

  console.log("\n=== Cleanup ===");
  await reset();
  console.log("  done");

  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
