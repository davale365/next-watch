import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { reactions, titles, type Title } from "@/db/schema";

export interface AddedTitleRow {
  title: Title;
  reaction: "binged" | "liked" | "watched" | "dropped" | "not_for_me" | null;
}

export async function listAddedTitlesForUser(
  userId: string
): Promise<AddedTitleRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(reactions)
    .where(eq(reactions.userId, userId));
  if (rows.length === 0) return [];
  const titleIds = rows.map((r) => r.titleId);
  const titleRows = await db
    .select()
    .from(titles)
    .where(inArray(titles.id, titleIds));
  const byId = new Map(titleRows.map((t) => [t.id, t]));
  const out: AddedTitleRow[] = [];
  for (const r of rows) {
    const title = byId.get(r.titleId);
    if (!title) continue;
    out.push({ title, reaction: r.reaction });
  }
  return out;
}
