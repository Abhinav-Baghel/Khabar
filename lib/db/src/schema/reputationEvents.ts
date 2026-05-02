import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const reputationEventsTable = pgTable("reputation_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  pointsChange: integer("points_change").notNull(),
  reason: text("reason").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
});

export type ReputationEventRow = typeof reputationEventsTable.$inferSelect;
export type InsertReputationEventRow = typeof reputationEventsTable.$inferInsert;
