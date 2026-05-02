import { pgTable, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    uid: text("uid").primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    phoneNumber: text("phone_number"),
    state: text("state").notNull().default("Unknown"),
    district: text("district").notNull().default("Unknown"),
    locality: text("locality").notNull().default("Unknown"),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
    googleId: text("google_id"),
    photoUrl: text("photo_url"),
    currentReputationScore: integer("current_reputation_score")
      .notNull()
      .default(0),
    readCount: integer("read_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_unique").on(t.username),
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_google_id_unique").on(t.googleId),
  ],
);

export type UserRow = typeof usersTable.$inferSelect;
export type InsertUserRow = typeof usersTable.$inferInsert;
