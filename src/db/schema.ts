import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  uuid,
  primaryKey,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const mediaTypeEnum = pgEnum("media_type", ["movie", "tv"]);

export const reactionEnum = pgEnum("reaction", [
  "binged",
  "liked",
  "watched",
  "dropped",
  "not_for_me",
]);

export const monetizationEnum = pgEnum("monetization", [
  "flatrate",
  "free",
  "ads",
  "rent",
  "buy",
]);

export const feedbackActionEnum = pgEnum("feedback_action", [
  "shown",
  "dismissed",
  "interested",
  "watchlist",
  "not_for_me",
  "already_seen",
]);

export const recommendationBucketEnum = pgEnum("recommendation_bucket", [
  "safe",
  "stretch",
  "gem",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  region: text("region").notNull(),
  selectedPlatforms: integer("selected_platforms").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const titles = pgTable(
  "titles",
  {
    id: text("id").primaryKey(),
    tmdbId: integer("tmdb_id").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    title: text("title").notNull(),
    year: integer("year"),
    posterPath: text("poster_path"),
    overview: text("overview"),
    runtimeMinutes: integer("runtime_minutes"),
    genres: integer("genres").array().notNull().default([]),
    keywords: integer("keywords").array().notNull().default([]),
    castTop: integer("cast_top").array().notNull().default([]),
    castTopNames: text("cast_top_names").array().notNull().default([]),
    directors: integer("directors").array().notNull().default([]),
    directorsNames: text("directors_names").array().notNull().default([]),
    voteAverage: doublePrecision("vote_average"),
    voteCount: integer("vote_count"),
    popularity: doublePrecision("popularity"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("titles_tmdb_id_idx").on(t.tmdbId, t.mediaType)]
);

export const availability = pgTable(
  "availability",
  {
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    region: text("region").notNull(),
    providerId: integer("provider_id").notNull(),
    monetization: monetizationEnum("monetization").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.titleId, t.region, t.providerId, t.monetization] }),
    index("availability_region_provider_idx").on(t.region, t.providerId),
  ]
);

export const reactions = pgTable(
  "reactions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    reaction: reactionEnum("reaction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })]
);

export const feedbackEvents = pgTable(
  "feedback_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    action: feedbackActionEnum("action").notNull(),
    bucket: recommendationBucketEnum("bucket"),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("feedback_user_idx").on(t.userId, t.createdAt),
    index("feedback_user_action_idx").on(t.userId, t.action),
  ]
);

export const watchlist = pgTable(
  "watchlist",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Title = typeof titles.$inferSelect;
export type NewTitle = typeof titles.$inferInsert;
export type Availability = typeof availability.$inferSelect;
export type NewAvailability = typeof availability.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type FeedbackEvent = typeof feedbackEvents.$inferSelect;
export type NewFeedbackEvent = typeof feedbackEvents.$inferInsert;
export type WatchlistEntry = typeof watchlist.$inferSelect;
export type NewWatchlistEntry = typeof watchlist.$inferInsert;
