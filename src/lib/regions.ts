export type RegionCode = "GB" | "US" | "DE" | "FR" | "IE" | "AU" | "CA";

export type RegionStatus = "active" | "coming_soon";

export interface Region {
  code: RegionCode;
  label: string;
  status: RegionStatus;
}

export const REGIONS: Region[] = [
  { code: "GB", label: "United Kingdom", status: "active" },
  { code: "US", label: "United States", status: "coming_soon" },
  { code: "IE", label: "Ireland", status: "coming_soon" },
  { code: "DE", label: "Germany", status: "coming_soon" },
  { code: "FR", label: "France", status: "coming_soon" },
  { code: "AU", label: "Australia", status: "coming_soon" },
  { code: "CA", label: "Canada", status: "coming_soon" },
];

export const DEFAULT_REGION: RegionCode = "GB";

export const ACTIVE_REGION_COPY =
  "Currently optimised for UK streaming availability.";

export function isRegionActive(code: string): code is RegionCode {
  return REGIONS.find((r) => r.code === code)?.status === "active";
}
