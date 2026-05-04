import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const totalGB = (await sql`SELECT count(*)::int AS c FROM availability WHERE region = 'GB'`) as { c: number }[];
  console.log("Total GB availability rows:", totalGB[0].c);

  const sample = (await sql`
    SELECT title_id, monetization, count(*)::int AS providers
    FROM availability
    WHERE region = 'GB'
    GROUP BY title_id, monetization
    ORDER BY title_id
    LIMIT 30
  `) as { title_id: string; monetization: string; providers: number }[];
  console.log("Sample (title_id, monetization, count):");
  for (const r of sample) console.log(" ", r);

  const tvIds = ["tv:1622", "tv:5920", "tv:2734", "tv:124364"];
  for (const id of tvIds) {
    const rows = (await sql`
      SELECT title_id, region, provider_id, monetization
      FROM availability
      WHERE title_id = ${id} AND region = 'GB'
    `) as { provider_id: number; monetization: string }[];
    console.log(`${id} GB rows:`, rows.length, rows);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
