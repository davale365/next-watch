"use server";

import { z } from "zod";
import { getDb } from "@/db/client";
import { feedbackEvents, watchlist } from "@/db/schema";
import { requireUser } from "@/lib/user/session";
import { logEvent } from "@/lib/log";

const FEEDBACK_ACTIONS = [
  "interested",
  "watchlist",
  "not_for_me",
  "already_seen",
] as const;

const BUCKETS = ["safe", "stretch", "gem"] as const;

const inputSchema = z.object({
  titleId: z.string().min(1),
  action: z.enum(FEEDBACK_ACTIONS),
  bucket: z.enum(BUCKETS).optional(),
  sessionId: z.string().optional(),
});

export async function recordFeedbackAction(input: {
  titleId: string;
  action: (typeof FEEDBACK_ACTIONS)[number];
  bucket?: (typeof BUCKETS)[number];
  sessionId?: string;
}): Promise<{ ok: true }> {
  const parsed = inputSchema.parse(input);
  const user = await requireUser();
  const db = getDb();

  await db.insert(feedbackEvents).values({
    userId: user.id,
    titleId: parsed.titleId,
    action: parsed.action,
    bucket: parsed.bucket ?? null,
    sessionId: parsed.sessionId ?? null,
  });

  if (parsed.action === "watchlist") {
    await db
      .insert(watchlist)
      .values({ userId: user.id, titleId: parsed.titleId })
      .onConflictDoNothing();
  }

  logEvent("picks.feedback", {
    user_id: user.id,
    title_id: parsed.titleId,
    action: parsed.action,
    bucket: parsed.bucket ?? null,
    session_id: parsed.sessionId ?? null,
  });

  return { ok: true };
}
