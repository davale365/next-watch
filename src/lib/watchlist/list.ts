import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { availability, titles, watchlist, type Title } from "@/db/schema";
import type { RegionCode } from "@/lib/regions";

export interface WatchlistEntry {
  title: Title;
  addedAt: Date;
  providerIds: number[];
}

export async function listWatchlistForUser(input: {
  userId: string;
  region: RegionCode;
  selectedPlatforms: number[];
}): Promise<WatchlistEntry[]> {
  const { userId, region, selectedPlatforms } = input;
  const db = getDb();
  const rows = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.addedAt));
  if (rows.length === 0) return [];

  const titleIds = rows.map((r) => r.titleId);

  const titleRows = await db
    .select()
    .from(titles)
    .where(inArray(titles.id, titleIds));
  const titlesById = new Map(titleRows.map((t) => [t.id, t]));

  const providersByTitleId = new Map<string, Set<number>>();
  if (selectedPlatforms.length > 0) {
    const allowed = new Set(selectedPlatforms);
    const availabilityRows = await db
      .select({
        titleId: availability.titleId,
        providerId: availability.providerId,
        monetization: availability.monetization,
      })
      .from(availability)
      .where(
        and(
          inArray(availability.titleId, titleIds),
          eq(availability.region, region)
        )
      );
    for (const a of availabilityRows) {
      if (
        a.monetization !== "flatrate" &&
        a.monetization !== "free" &&
        a.monetization !== "ads"
      )
        continue;
      if (!allowed.has(a.providerId)) continue;
      let set = providersByTitleId.get(a.titleId);
      if (!set) {
        set = new Set<number>();
        providersByTitleId.set(a.titleId, set);
      }
      set.add(a.providerId);
    }
  }

  const out: WatchlistEntry[] = [];
  for (const r of rows) {
    const title = titlesById.get(r.titleId);
    if (!title) continue;
    out.push({
      title,
      addedAt: r.addedAt,
      providerIds: Array.from(providersByTitleId.get(r.titleId) ?? []),
    });
  }
  return out;
}
