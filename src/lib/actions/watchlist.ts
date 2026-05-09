"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { feedbackEvents, reactions, watchlist } from "@/db/schema";
import { requireUser } from "@/lib/user/session";

const inputSchema = z.object({
  titleId: z.string().min(1),
});

export async function removeFromWatchlistAction(input: {
  titleId: string;
}): Promise<{ titleId: string }> {
  const { titleId } = inputSchema.parse(input);
  const user = await requireUser();
  const db = getDb();

  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.titleId, titleId)));

  await db
    .delete(feedbackEvents)
    .where(
      and(
        eq(feedbackEvents.userId, user.id),
        eq(feedbackEvents.titleId, titleId),
        eq(feedbackEvents.action, "watchlist")
      )
    );

  return { titleId };
}

export async function markWatchedFromWatchlistAction(input: {
  titleId: string;
}): Promise<{ titleId: string }> {
  const { titleId } = inputSchema.parse(input);
  const user = await requireUser();
  const db = getDb();

  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.titleId, titleId)));

  await db
    .delete(feedbackEvents)
    .where(
      and(
        eq(feedbackEvents.userId, user.id),
        eq(feedbackEvents.titleId, titleId),
        eq(feedbackEvents.action, "watchlist")
      )
    );

  await db
    .insert(reactions)
    .values({ userId: user.id, titleId, reaction: "watched" })
    .onConflictDoNothing();

  return { titleId };
}
