import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: text("author_id").notNull(),
  headline: text("headline").notNull(),
  details: text("details").notNull().default(""),
  category: text("category").notNull(),
  isBreaking: boolean("is_breaking").notNull().default(false),
  lat: doublePrecision("lat").notNull().default(22.7196),
  lng: doublePrecision("lng").notNull().default(75.8577),
  neighborhood: text("neighborhood").notNull().default("Unknown"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PostRow = typeof postsTable.$inferSelect;
export type InsertPostRow = typeof postsTable.$inferInsert;
