import { Router, type IRouter } from "express";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { db, postsTable, usersTable } from "@workspace/db";
import {
  ListTrendingLocalitiesResponse,
  GetStatsOverviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trending/localities", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      neighborhood: postsTable.neighborhood,
      postCount: sql<number>`count(*)::int`,
      breakingCount: sql<number>`count(*) filter (where ${postsTable.isBreaking})::int`,
    })
    .from(postsTable)
    .groupBy(postsTable.neighborhood)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  res.json(
    ListTrendingLocalitiesResponse.parse(
      rows.map((r) => ({
        neighborhood: r.neighborhood,
        postCount: r.postCount,
        breakingCount: r.breakingCount,
      })),
    ),
  );
});

router.get("/stats/overview", async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24);

  const [totals] = await db
    .select({
      totalPosts: sql<number>`count(*)::int`,
      breakingNow: sql<number>`count(*) filter (where ${postsTable.isBreaking})::int`,
    })
    .from(postsTable);

  const [verifiedToday] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(
      and(
        eq(postsTable.verificationStatus, "verified"),
        gte(postsTable.createdAt, since),
      ),
    );

  const [activeReporters] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable);

  const categoryRows = await db
    .select({
      category: postsTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(postsTable)
    .groupBy(postsTable.category);

  res.json(
    GetStatsOverviewResponse.parse({
      totalPosts: totals?.totalPosts ?? 0,
      breakingNow: totals?.breakingNow ?? 0,
      verifiedToday: verifiedToday?.c ?? 0,
      activeReporters: activeReporters?.c ?? 0,
      categoryCounts: categoryRows.map((r) => ({
        category: r.category,
        count: r.count,
      })),
    }),
  );
});

export default router;
