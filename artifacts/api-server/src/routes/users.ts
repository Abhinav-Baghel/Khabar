import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  postsTable,
  reputationEventsTable,
} from "@workspace/db";
import {
  ListUsersResponse,
  ListTopReportersQueryParams,
  ListTopReportersResponse,
  GetUserParams,
  GetUserResponse,
} from "@workspace/api-zod";
import {
  getUserCountsBatch,
  serializePublicUser,
  serializePosts,
} from "../lib/serializers";
import { loadCurrentUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable);
  const counts = await getUserCountsBatch(rows.map((r) => r.uid));
  res.json(
    ListUsersResponse.parse(
      rows.map((r) =>
        serializePublicUser(r, counts.get(r.uid) ?? { postCount: 0, verifiedCount: 0 }),
      ),
    ),
  );
});

router.get("/users/top", async (req, res): Promise<void> => {
  const parsed = ListTopReportersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const limit = parsed.data.limit ?? 8;
  const rows = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.currentReputationScore))
    .limit(limit);
  const counts = await getUserCountsBatch(rows.map((r) => r.uid));
  res.json(
    ListTopReportersResponse.parse(
      rows.map((r) =>
        serializePublicUser(r, counts.get(r.uid) ?? { postCount: 0, verifiedCount: 0 }),
      ),
    ),
  );
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.uid, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const counts = await getUserCountsBatch([user.uid]);
  const reputationHistory = await db
    .select()
    .from(reputationEventsTable)
    .where(eq(reputationEventsTable.userId, user.uid))
    .orderBy(reputationEventsTable.date);
  const recentPostsRows = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.authorId, user.uid))
    .orderBy(desc(postsTable.createdAt))
    .limit(6);
  const currentUser = await loadCurrentUser(req);
  const recentPosts = await serializePosts(recentPostsRows, currentUser?.uid);
  const userCounts = counts.get(user.uid) ?? { postCount: 0, verifiedCount: 0 };

  res.json(
    GetUserResponse.parse({
      ...serializePublicUser(user, userCounts),
      reputationHistory: reputationHistory.map((e) => ({
        id: e.id,
        date: e.date.toISOString(),
        pointsChange: e.pointsChange,
        reason: e.reason,
      })),
      recentPosts,
    }),
  );
});

export default router;
