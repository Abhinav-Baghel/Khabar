import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const postMediaTable = pgTable("post_media", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  url: text("url").notNull(),
  kind: text("kind").notNull(), // "photo" | "video"
  contentType: text("content_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PostMediaRow = typeof postMediaTable.$inferSelect;
export type InsertPostMediaRow = typeof postMediaTable.$inferInsert;

