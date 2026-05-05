import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { titles, watchlist, type Title } from "@/db/schema";

export interface WatchlistEntry {
  title: Title;
  addedAt: Date;
}

export async function listWatchlistForUser(
  userId: string
): Promise<WatchlistEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.addedAt));
  if (rows.length === 0) return [];
  const titleRows = await db
    .select()
    .from(titles)
    .where(
      inArray(
        titles.id,
        rows.map((r) => r.titleId)
      )
    );
  const byId = new Map(titleRows.map((t) => [t.id, t]));
  const out: WatchlistEntry[] = [];
  for (const r of rows) {
    const title = byId.get(r.titleId);
    if (!title) continue;
    out.push({ title, addedAt: r.addedAt });
  }
  return out;
}
