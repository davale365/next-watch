import type { RegionCode } from "@/lib/regions";
import type { TmdbMediaType } from "@/lib/tmdb/types";

export type Monetization = "flatrate" | "free" | "ads" | "rent" | "buy";

export interface AvailabilityRow {
  providerId: number;
  monetization: Monetization;
}

export interface GetProvidersInput {
  titleId: string;
  tmdbId: number;
  mediaType: TmdbMediaType;
  region: RegionCode;
}

export interface AvailabilityProvider {
  getProviders(input: GetProvidersInput): Promise<AvailabilityRow[]>;
}

export const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 14;
