import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users, type User } from "@/db/schema";
import { DEFAULT_REGION } from "@/lib/regions";
import { USER_COOKIE_MAX_AGE, USER_COOKIE_NAME } from "@/lib/cookies";

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(USER_COOKIE_NAME)?.value;
  if (!id) return null;
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function ensureUser(): Promise<User> {
  const existing = await getCurrentUser();
  if (existing) return existing;

  const db = getDb();
  const [created] = await db
    .insert(users)
    .values({ region: DEFAULT_REGION, selectedPlatforms: [] })
    .returning();

  const store = await cookies();
  store.set(USER_COOKIE_NAME, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: USER_COOKIE_MAX_AGE,
    path: "/",
  });

  return created;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("No active user session");
  }
  return user;
}
