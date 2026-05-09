import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schemaModule from "../src/db/schema";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaCjs =
  (schemaModule as unknown as { default?: typeof schemaModule }).default ??
  schemaModule;
const { feedbackEvents, watchlist } = schemaCjs;

const USER_ID = "a768050f-57e0-4ed1-bc0a-d1d90a6b6c03";
const PORT = 3001;
const COOKIE = `next-watch-uid=${USER_ID}`;
const DEV_LOG_PATH = process.env.DEV_LOG_PATH;

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

function check(label: string, ok: boolean, detail?: string) {
  const mark = ok ? "  OK   " : "  FAIL ";
  console.log(`${mark} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("\n=== A. loading.tsx files exist + contain skeleton markup ===");
  const loadingFiles = [
    "src/app/picks/loading.tsx",
    "src/app/watchlist/loading.tsx",
  ];
  for (const path of loadingFiles) {
    const abs = resolve(path);
    check(`${path} exists`, existsSync(abs));
    if (existsSync(abs)) {
      const contents = readFileSync(abs, "utf-8");
      check(
        `${path} renders Skeleton primitive`,
        contents.includes("<Skeleton") || contents.includes("Skeleton ")
      );
      check(
        `${path} sets aria-busy="true"`,
        contents.includes('aria-busy="true"')
      );
    }
  }
  // Skeleton primitive uses animate-pulse
  const skel = readFileSync(resolve("src/components/Skeleton.tsx"), "utf-8");
  check("Skeleton primitive uses animate-pulse", skel.includes("animate-pulse"));

  console.log("\n=== B. /picks emits a picks.request JSON log line ===");
  if (!DEV_LOG_PATH) {
    console.log(
      "  SKIP: set DEV_LOG_PATH=<dev-server-output-file> to validate stdout logs."
    );
  } else {
    await db
      .delete(feedbackEvents)
      .where(eq(feedbackEvents.userId, USER_ID));
    await db.delete(watchlist).where(eq(watchlist.userId, USER_ID));

    const beforeMarker = `__M5_TEST_${Date.now()}__`;
    const res = await fetch(`http://localhost:${PORT}/picks`, {
      headers: { Cookie: COOKIE, "x-test-marker": beforeMarker },
    });
    check("/picks returns 200", res.status === 200);

    // Give the dev server a moment to flush the log line.
    await new Promise((r) => setTimeout(r, 500));

    const text = readFileSync(DEV_LOG_PATH, "utf-8");
    const lines = text.split(/\r?\n/);
    const jsonLines: Array<Record<string, unknown>> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj === "object") jsonLines.push(obj);
      } catch {
        // ignore non-JSON output (Next.js compile messages, etc.)
      }
    }
    const requestLines = jsonLines.filter((o) => o["event"] === "picks.request");
    const requestLine = requestLines[requestLines.length - 1];
    check(
      "At least one picks.request log line observed",
      requestLines.length >= 1,
      `${requestLines.length} found`
    );
    if (requestLine) {
      const r = requestLine;
      const required = [
        "ts",
        "event",
        "request_id",
        "user_id",
        "region",
        "platform_count",
        "mood",
        "time",
        "transient_exclude_count",
        "reason",
        "slate_n",
        "queue_n",
        "slate_confidences",
        "queue_confidences",
        "total_ms",
      ];
      for (const f of required) {
        check(`field present: ${f}`, f in r, JSON.stringify(r[f]));
      }
      check(
        "user_id matches our cookie",
        r["user_id"] === USER_ID,
        String(r["user_id"])
      );
      check(
        "total_ms is a positive number",
        typeof r["total_ms"] === "number" && (r["total_ms"] as number) >= 0
      );
      check(
        "slate_confidences is an array",
        Array.isArray(r["slate_confidences"])
      );
      check(
        "queue_confidences is an array",
        Array.isArray(r["queue_confidences"])
      );
      check(
        "Has at least one phase duration field",
        Object.keys(r).some((k) => k.endsWith("_ms") && k !== "total_ms")
      );
      console.log("  picks.request payload (truncated):");
      const display: Record<string, unknown> = {};
      for (const k of Object.keys(r).sort()) display[k] = r[k];
      console.log(
        "  ",
        JSON.stringify(display).slice(0, 320),
        JSON.stringify(display).length > 320 ? "…" : ""
      );
    }
  }

  console.log("\n=== C. logEvent never crashes the request ===");
  // Smoke: importing the helper succeeds and JSON-serialising arbitrary fields
  // is safe. (The actual catch path is exercised in production; here we just
  // sanity-check the export shape.)
  const logModule = readFileSync(resolve("src/lib/log.ts"), "utf-8");
  check(
    "logEvent has a try/catch around JSON.stringify+console.log",
    /try\s*\{[\s\S]*JSON\.stringify[\s\S]*\}\s*catch/.test(logModule)
  );

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
