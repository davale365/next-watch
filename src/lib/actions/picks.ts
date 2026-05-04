"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/user/session";
import { getPicks } from "@/lib/recommender/engine";
import type { PicksResult } from "@/lib/recommender/types";

export async function getPicksAction(): Promise<PicksResult> {
  const user = await requireUser();
  return getPicks(user);
}

export async function refreshPicksAction(): Promise<PicksResult> {
  const user = await requireUser();
  const result = await getPicks(user);
  revalidatePath("/picks");
  return result;
}
