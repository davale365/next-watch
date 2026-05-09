"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { reactions } from "@/db/schema";
import { ensureUser, requireUser } from "@/lib/user/session";
import {
  ensureAvailabilityForTitle,
  upsertTitle,
} from "@/lib/titles/upsert";
import { maybeEnrichTitle } from "@/lib/titles/enrich";
import type { AddedTitleRow } from "@/lib/titles/list";
import type { RegionCode } from "@/lib/regions";

const REACTION_VALUES = [
  "binged",
  "liked",
  "watched",
  "dropped",
  "not_for_me",
] as const;

const addTitleSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
});

const setReactionSchema = z.object({
  titleId: z.string().min(1),
  reaction: z.enum(REACTION_VALUES),
});

const removeTitleSchema = z.object({
  titleId: z.string().min(1),
});

export type AddedTitle = AddedTitleRow;

export async function addTitleAction(input: {
  tmdbId: number;
  mediaType: "movie" | "tv";
}): Promise<AddedTitle> {
  const parsed = addTitleSchema.parse(input);
  const user = await ensureUser();
  const title = await upsertTitle(parsed);
  await ensureAvailabilityForTitle({
    title,
    region: user.region as RegionCode,
  });
  await maybeEnrichTitle({
    titleId: title.id,
    mediaType: title.mediaType,
    tmdbId: title.tmdbId,
  });
  const db = getDb();
  const existing = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.userId, user.id), eq(reactions.titleId, title.id)))
    .limit(1);
  return { title, reaction: existing[0]?.reaction ?? null };
}

export async function setReactionAction(input: {
  titleId: string;
  reaction: (typeof REACTION_VALUES)[number];
}): Promise<{ titleId: string; reaction: (typeof REACTION_VALUES)[number] }> {
  const parsed = setReactionSchema.parse(input);
  const user = await requireUser();
  const db = getDb();
  await db
    .insert(reactions)
    .values({
      userId: user.id,
      titleId: parsed.titleId,
      reaction: parsed.reaction,
    })
    .onConflictDoUpdate({
      target: [reactions.userId, reactions.titleId],
      set: { reaction: parsed.reaction },
    });
  return parsed;
}

export async function removeTitleAction(input: { titleId: string }): Promise<{
  titleId: string;
}> {
  const parsed = removeTitleSchema.parse(input);
  const user = await requireUser();
  const db = getDb();
  await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.userId, user.id),
        eq(reactions.titleId, parsed.titleId)
      )
    );
  return parsed;
}

