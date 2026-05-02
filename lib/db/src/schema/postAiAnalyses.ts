import { pgTable, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";

export const postAiAnalysesTable = pgTable("post_ai_analyses", {
  postId: integer("post_id").primaryKey(),
  hateSpeech: boolean("hate_speech").notNull(),
  sensationalismScore: integer("sensationalism_score").notNull(),
  credibilityAssessment: text("credibility_assessment").notNull(),
  verdict: text("verdict").notNull(),
  rawJson: text("raw_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PostAiAnalysisRow = typeof postAiAnalysesTable.$inferSelect;
export type InsertPostAiAnalysisRow = typeof postAiAnalysesTable.$inferInsert;

