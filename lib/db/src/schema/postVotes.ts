import { pgTable, integer, text, primaryKey } from "drizzle-orm/pg-core";

export const postVotesTable = pgTable(
  "post_votes",
  {
    postId: integer("post_id").notNull(),
    userId: text("user_id").notNull(),
    direction: text("direction").notNull(), // "up" | "down"
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export type PostVoteRow = typeof postVotesTable.$inferSelect;
