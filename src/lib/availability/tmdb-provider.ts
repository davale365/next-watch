import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { availability } from "@/db/schema";
import { getWatchProviders } from "@/lib/tmdb/endpoints";
import type { TmdbRegionProviders } from "@/lib/tmdb/types";
import type {
  AvailabilityProvider,
  AvailabilityRow,
  GetProvidersInput,
  Monetization,
} from "./types";
import { STALE_AFTER_MS } from "./types";

const MONETIZATION_BUCKETS: Monetization[] = [
  "flatrate",
  "free",
  "ads",
  "rent",
  "buy",
];

function flattenRegion(region: TmdbRegionProviders | undefined): AvailabilityRow[] {
  if (!region) return [];
  const rows: AvailabilityRow[] = [];
  for (const bucket of MONETIZATION_BUCKETS) {
    const entries = region[bucket];
    if (!entries) continue;
    for (const e of entries) {
      rows.push({ providerId: e.provider_id, monetization: bucket });
    }
  }
  return rows;
}

export class TmdbAvailabilityProvider implements AvailabilityProvider {
  async getProviders(input: GetProvidersInput): Promise<AvailabilityRow[]> {
    const db = getDb();

    const cached = await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.titleId, input.titleId),
          eq(availability.region, input.region)
        )
      );

    const fresh = cached.length > 0 && isFresh(cached[0].fetchedAt);
    if (fresh) {
      return cached.map((row) => ({
        providerId: row.providerId,
        monetization: row.monetization,
      }));
    }

    const fetched = await this.fetchAndPersist(input);
    return fetched;
  }

  private async fetchAndPersist(
    input: GetProvidersInput
  ): Promise<AvailabilityRow[]> {
    const db = getDb();
    const response = await getWatchProviders(input.mediaType, input.tmdbId);
    const rows = flattenRegion(response.results[input.region]);

    await db
      .delete(availability)
      .where(
        and(
          eq(availability.titleId, input.titleId),
          eq(availability.region, input.region)
        )
      );

    if (rows.length > 0) {
      await db.insert(availability).values(
        rows.map((row) => ({
          titleId: input.titleId,
          region: input.region,
          providerId: row.providerId,
          monetization: row.monetization,
        }))
      );
    }

    return rows;
  }
}

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < STALE_AFTER_MS;
}
