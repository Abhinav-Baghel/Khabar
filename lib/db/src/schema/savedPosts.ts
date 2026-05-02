import { pgTable, integer, text, primaryKey, timestamp } from "drizzle-orm/pg-core";

export const savedPostsTable = pgTable(
  "saved_posts",
  {
    postId: integer("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export type SavedPostRow = typeof savedPostsTable.$inferSelect;
