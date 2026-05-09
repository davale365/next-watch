"use server";

import { z } from "zod";
import { requireUser } from "@/lib/user/session";
import { getPicks } from "@/lib/recommender/engine";
import {
  parseMood,
  parseTimeBudget,
} from "@/lib/recommender/filters";
import type { PicksResult } from "@/lib/recommender/types";

const inputSchema = z.object({
  excludeTitleIds: z.array(z.string().min(1)).max(200),
  mood: z.string().optional(),
  time: z.string().optional(),
});

export async function getDifferentPicksAction(input: {
  excludeTitleIds: string[];
  mood?: string;
  time?: string;
}): Promise<PicksResult> {
  const parsed = inputSchema.parse(input);
  const user = await requireUser();
  return getPicks(user, {
    mood: parseMood(parsed.mood),
    time: parseTimeBudget(parsed.time),
    transientExcludeIds: parsed.excludeTitleIds,
  });
}
