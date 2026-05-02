# Next Watch

An independent watch decision engine that returns exactly **3 confident picks** (Safe / Stretch / Hidden Gem) tailored to your recent reactions, subscribed streaming platforms, and region. UK-first.

> Currently optimised for UK streaming availability.

## Status

Phase 0 — project skeleton, DB schema, TMDB client. Not user-facing yet.

See `.claude/plans/before-writing-any-code-flickering-parnas.md` (in your home directory) for the full implementation plan.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Database**: Postgres (Neon) via Drizzle ORM
- **State**: TanStack Query (server) + Zustand (client) — added in Phase 1
- **External data**: TMDB API (v4 read token)
- **Analytics**: PostHog Cloud (added in Phase 4)

## Getting started

### 1. Prerequisites
- Node 18.18+ (you have v25; fine).
- A free [Neon](https://neon.tech) project — copy the pooled connection string.
- A free [TMDB](https://www.themoviedb.org/settings/api) account — copy the **API Read Access Token** (v4).

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env.local
```
Then fill in `DATABASE_URL` and `TMDB_API_READ_TOKEN`. PostHog vars can stay empty until Phase 4.

### 4. Apply the schema
```bash
npm run db:push
```
This pushes the Drizzle schema directly to your Neon database (no migration files needed for early dev). When the schema stabilises we'll switch to `db:generate` + applied migrations.

### 5. Run the dev server
```bash
npm run dev
```
Open http://localhost:3000.

## Project layout
```
src/
  app/                  Next.js App Router routes
  components/ui/        shadcn/ui primitives
  db/
    client.ts           Lazy Drizzle client backed by @neondatabase/serverless
    schema.ts           6-table schema: users, titles, availability, reactions, feedback_events, watchlist
  lib/
    regions.ts          Region enum (UK active; others "Coming Soon")
    providers.ts        UK streaming providers mapped to TMDB provider IDs
    tmdb/
      client.ts         Server-only fetch wrapper with in-process memoisation
      endpoints.ts      Typed wrappers: search/multi, watch/providers, movie/{id}, tv/{id}
      types.ts          TMDB response types
    availability/
      types.ts          AvailabilityProvider interface + AvailabilityRow type
      tmdb-provider.ts  TMDB-backed implementation with the 14-day single-retry cache rule
      index.ts          Public exports
drizzle.config.ts       Drizzle Kit config (reads DATABASE_URL from .env or env)
```

## Phase 0 verification
```bash
npm run typecheck   # tsc --noEmit
npm run build       # next build
npm run dev         # then visit http://localhost:3000
npm run db:push     # only after DATABASE_URL is set
```

## Attribution
This product uses the TMDB API but is not endorsed or certified by TMDB.
Streaming availability data via TMDB / JustWatch.
