import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const before = (await sql`SELECT count(*)::int AS c FROM users`) as {
    c: number;
  }[];
  console.log("users before:", before[0].c);
  const deleted = (await sql`
    DELETE FROM users
    WHERE id NOT IN (SELECT user_id FROM reactions)
      AND id NOT IN (SELECT user_id FROM watchlist)
      AND id NOT IN (SELECT user_id FROM feedback_events)
    RETURNING id, created_at
  `) as { id: string; created_at: string }[];
  console.log("deleted:", deleted.length, "rows");
  for (const d of deleted) console.log("  ", d.id, d.created_at);
  const after = (await sql`SELECT count(*)::int AS c FROM users`) as {
    c: number;
  }[];
  console.log("users after:", after[0].c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
