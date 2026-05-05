import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { feedbackEvents } from "@/db/schema";

export interface FeedbackContribution {
  titleId: string;
  weight: number;
}

export interface FeedbackLoad {
  excludedTitleIds: Set<string>;
  signals: FeedbackContribution[];
}

const HALF_LIFE_DAYS = 30;
const DAY_MS = 1000 * 60 * 60 * 24;

const BASE_WEIGHT: Record<string, number> = {
  watchlist: 1.5,
  interested: 1.0,
  not_for_me: -1.0,
  already_seen: 0,
};

function decayFor(createdAt: Date): number {
  const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / DAY_MS);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export async function loadFeedbackForUser(userId: string): Promise<FeedbackLoad> {
  const db = getDb();
  const rows = await db
    .select()
    .from(feedbackEvents)
    .where(eq(feedbackEvents.userId, userId));

  const latestPerTitle = new Map<string, (typeof rows)[number]>();
  const excluded = new Set<string>();

  for (const r of rows) {
    if (r.action === "shown" || r.action === "dismissed") continue;
    excluded.add(r.titleId);
    const existing = latestPerTitle.get(r.titleId);
    if (!existing || r.createdAt > existing.createdAt) {
      latestPerTitle.set(r.titleId, r);
    }
  }

  const signals: FeedbackContribution[] = [];
  for (const [titleId, event] of latestPerTitle) {
    const base = BASE_WEIGHT[event.action];
    if (!base) continue;
    const decayed = base * decayFor(event.createdAt);
    if (Math.abs(decayed) < 0.05) continue;
    signals.push({ titleId, weight: decayed });
  }

  return { excludedTitleIds: excluded, signals };
}
