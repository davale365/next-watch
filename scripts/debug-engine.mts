import { config } from "dotenv";
config({ path: ".env.local" });

const TMDB = "https://api.themoviedb.org/3";
const token = process.env.TMDB_API_READ_TOKEN!;

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

const SELECTED = new Set([8, 337, 350, 39, 9, 531]);
const SELECTED_NAMES: Record<number, string> = {
  8: "Netflix",
  337: "Disney+",
  350: "Apple TV+",
  39: "NOW",
  9: "Prime",
  531: "Paramount+",
};

async function checkTitle(mediaType: "movie" | "tv", id: number, label: string) {
  const recs = (await tmdb(`/${mediaType}/${id}/recommendations`)) as {
    results: { id: number; title?: string; name?: string; media_type?: string }[];
  };
  console.log(`\n=== ${label} (${mediaType} ${id}) -> ${recs.results.length} recommendations ===`);
  const top10 = recs.results.slice(0, 10);

  for (const r of top10) {
    const mt = (r.media_type as "movie" | "tv") || mediaType;
    try {
      const prov = (await tmdb(`/${mt}/${r.id}/watch/providers`)) as {
        results: Record<string, {
          flatrate?: { provider_id: number; provider_name: string }[];
          free?: { provider_id: number; provider_name: string }[];
          ads?: { provider_id: number; provider_name: string }[];
        } | undefined>;
      };
      const gb = prov.results["GB"];
      const flat = gb?.flatrate?.map((p) => `${p.provider_id}=${p.provider_name}`) ?? [];
      const matched = flat.filter((s) => SELECTED.has(Number(s.split("=")[0])));
      console.log(
        `  ${r.title || r.name} (${mt} ${r.id})`,
        flat.length > 0 ? `flatrate: [${flat.join(", ")}]` : "no flatrate in GB",
        matched.length > 0 ? `MATCH: ${matched.join(", ")}` : ""
      );
    } catch (e) {
      console.log(`  ${r.title || r.name} (${mt} ${r.id}) - error fetching providers`);
    }
  }
}

async function main() {
  console.log("Selected platforms:", Array.from(SELECTED).map((id) => `${id}=${SELECTED_NAMES[id]}`).join(", "));
  await checkTitle("tv", 95396, "Severance");
  await checkTitle("movie", 27205, "Inception");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
