"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { isRegionActive, REGIONS, type RegionCode } from "@/lib/regions";
import { providersForRegion } from "@/lib/providers";
import { ensureUser, requireUser } from "@/lib/user/session";
import type { User } from "@/db/schema";

const REGION_VALUES = REGIONS.map((r) => r.code) as [
  RegionCode,
  ...RegionCode[],
];

const updateRegionSchema = z.object({
  region: z.enum(REGION_VALUES),
});

const updatePlatformsSchema = z.object({
  platformIds: z.array(z.number().int().positive()).min(1).max(15),
});

export async function updateRegionAction(input: {
  region: string;
}): Promise<User> {
  const { region } = updateRegionSchema.parse(input);
  if (!isRegionActive(region)) {
    throw new Error(`Region ${region} is not currently supported`);
  }
  const user = await ensureUser();
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ region })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
}

export async function updatePlatformsAction(input: {
  platformIds: number[];
}): Promise<User> {
  const { platformIds } = updatePlatformsSchema.parse(input);
  const user = await requireUser();
  const allowed = new Set(
    providersForRegion(user.region as RegionCode).map((p) => p.id)
  );
  const filtered = platformIds.filter((id) => allowed.has(id));
  if (filtered.length === 0) {
    throw new Error("No valid platforms for the user's region");
  }
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ selectedPlatforms: filtered })
    .where(eq(users.id, user.id))
    .returning();
  return updated;
}
