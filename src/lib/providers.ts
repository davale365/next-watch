import type { RegionCode } from "@/lib/regions";

export interface StreamingProvider {
  id: number;
  name: string;
  slug: string;
}

const UK_PROVIDERS: StreamingProvider[] = [
  { id: 8, name: "Netflix", slug: "netflix" },
  { id: 9, name: "Prime Video", slug: "prime-video" },
  { id: 337, name: "Disney+", slug: "disney-plus" },
  { id: 350, name: "Apple TV+", slug: "apple-tv-plus" },
  { id: 39, name: "NOW", slug: "now" },
  { id: 531, name: "Paramount+", slug: "paramount-plus" },
  { id: 1796, name: "ITVX", slug: "itvx" },
  { id: 318, name: "BBC iPlayer", slug: "bbc-iplayer" },
  { id: 567, name: "Channel 4", slug: "channel-4" },
  { id: 215, name: "MUBI", slug: "mubi" },
];

const PROVIDERS_BY_REGION: Partial<Record<RegionCode, StreamingProvider[]>> = {
  GB: UK_PROVIDERS,
};

export function providersForRegion(region: RegionCode): StreamingProvider[] {
  return PROVIDERS_BY_REGION[region] ?? [];
}

export function providerById(
  region: RegionCode,
  id: number
): StreamingProvider | undefined {
  return providersForRegion(region).find((p) => p.id === id);
}
