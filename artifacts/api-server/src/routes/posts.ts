import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  postVotesTable,
  reputationEventsTable,
  savedPostsTable,
  postMediaTable,
  postAiAnalysesTable,
  usersTable,
} from "@workspace/db";
import {
  CreatePostBody,
  GetPostParams,
  GetPostResponse,
  ListPostsQueryParams,
  ListPostsResponse,
  SavePostBody,
  SavePostParams,
  SavePostResponse,
  VerifyPostBody,
  VerifyPostParams,
  VerifyPostResponse,
  VotePostBody,
  VotePostParams,
  VotePostResponse,
} from "@workspace/api-zod";
import { loadCurrentUser, requireAuth, type AuthedRequest } from "../lib/auth";
import { serializePosts } from "../lib/serializers";
import * as z from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router: IRouter = Router();

type AiAnalysis = {
  hateSpeech: boolean;
  sensationalismScore: number;
  credibilityAssessment: string;
  verdict: string;
};

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Failed to parse AI JSON");
  }
}

async function runAiAnalysis(opts: {
  postId: number;
  headline: string;
  details: string;
}): Promise<void> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return;

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction:
      "You are a strict JSON generator. Output ONLY a single JSON object and nothing else.",
  });

  const prompt = [
    "Analyze this local-news report for moderation + credibility.",
    "Return ONLY valid JSON with keys:",
    "{hateSpeech:boolean, sensationalismScore:number(0-10), credibilityAssessment:string, verdict:string}",
    "",
    `Headline: ${opts.headline}`,
    `Details: ${opts.details}`,
  ].join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let parsed: any;
  try {
    parsed = extractJsonObject(text);
  } catch {
    throw new Error("Failed to parse AI JSON");
  }

  const schema = z.object({
    hateSpeech: z.boolean(),
    sensationalismScore: z.number().min(0).max(10),
    credibilityAssessment: z.string().min(1),
    verdict: z.string().min(1),
  });
  const analysis = schema.parse(parsed) as AiAnalysis;

  await db
    .insert(postAiAnalysesTable)
    .values({
      postId: opts.postId,
      hateSpeech: analysis.hateSpeech,
      sensationalismScore: Math.round(analysis.sensationalismScore),
      credibilityAssessment: analysis.credibilityAssessment,
      verdict: analysis.verdict,
      rawJson: JSON.stringify(parsed),
    })
    .onConflictDoNothing();
}

const VERIFICATION_REWARDS: Record<string, number> = {
  unverified: 0,
  community: 5,
  editor: 10,
  verified: 20,
};

async function adjustReputation(
  userId: string,
  pointsChange: number,
  reason: string,
): Promise<void> {
  if (pointsChange === 0) return;
  await db
    .update(usersTable)
    .set({
      currentReputationScore: sql`${usersTable.currentReputationScore} + ${pointsChange}`,
    })
    .where(eq(usersTable.uid, userId));
  await db.insert(reputationEventsTable).values({
    userId,
    pointsChange,
    reason,
  });
}

router.get("/posts", async (req, res): Promise<void> => {
  const parsed = ListPostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, authorId, savedBy } = parsed.data;
  const conditions = [];
  if (category) conditions.push(eq(postsTable.category, category));
  if (authorId) conditions.push(eq(postsTable.authorId, authorId));

  let rows;
  if (savedBy) {
    rows = await db
      .select({
        id: postsTable.id,
        authorId: postsTable.authorId,
        headline: postsTable.headline,
        details: postsTable.details,
        category: postsTable.category,
        isBreaking: postsTable.isBreaking,
        lat: postsTable.lat,
        lng: postsTable.lng,
        neighborhood: postsTable.neighborhood,
        verificationStatus: postsTable.verificationStatus,
        upvotes: postsTable.upvotes,
        downvotes: postsTable.downvotes,
        createdAt: postsTable.createdAt,
      })
      .from(postsTable)
      .innerJoin(savedPostsTable, eq(savedPostsTable.postId, postsTable.id))
      .where(and(eq(savedPostsTable.userId, savedBy), ...conditions))
      .orderBy(desc(postsTable.isBreaking), desc(postsTable.createdAt));
  } else {
    rows = await db
      .select()
      .from(postsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(postsTable.isBreaking), desc(postsTable.createdAt));
  }

  const currentUser = await loadCurrentUser(req);
  const serialized = await serializePosts(rows, currentUser?.uid);
  res.json(ListPostsResponse.parse(serialized));
});

router.post("/posts", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = req.user!;
  const neighborhood =
    parsed.data.neighborhood?.trim() || user.locality || "Unknown";

  const [created] = await db
    .insert(postsTable)
    .values({
      authorId: user.uid,
      headline: parsed.data.headline.trim(),
      details: parsed.data.details.trim(),
      category: parsed.data.category,
      isBreaking: parsed.data.isBreaking,
      neighborhood,
      verificationStatus: "unverified",
    })
    .returning();

  await adjustReputation(user.uid, 1, "Filed a new report");

  void runAiAnalysis({
    postId: created!.id,
    headline: created!.headline,
    details: created!.details,
  }).catch((err) => req.log.error({ err }, "AI analysis failed"));

  const [serialized] = await serializePosts([created!], user.uid);
  res.status(201).json(GetPostResponse.parse(serialized));
});

const AttachPostMediaBody = z.object({
  media: z
    .array(
      z.object({
        url: z.string().url(),
        kind: z.enum(["photo", "video"]),
        contentType: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

router.post(
  "/posts/:id/media",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = GetPostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = AttachPostMediaBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const postId = params.data.id;
    const user = req.user!;
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (post.authorId !== user.uid) {
      res.status(403).json({ error: "Only the author can attach media" });
      return;
    }

    await db.insert(postMediaTable).values(
      body.data.media.map((m) => ({
        postId,
        url: m.url,
        kind: m.kind,
        contentType: m.contentType ?? null,
      })),
    );

    res.status(201).json({ ok: true });
  },
);

router.get("/posts/:id/media", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const postId = params.data.id;
  const rows = await db
    .select({ id: postMediaTable.id, url: postMediaTable.url, kind: postMediaTable.kind })
    .from(postMediaTable)
    .where(eq(postMediaTable.postId, postId))
    .orderBy(postMediaTable.id);
  res.json({ media: rows });
});

router.get("/posts/:id/ai-analysis", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const postId = params.data.id;
  const [row] = await db
    .select()
    .from(postAiAnalysesTable)
    .where(eq(postAiAnalysesTable.postId, postId));

  if (!row) {
    const [post] = await db
      .select({ createdAt: postsTable.createdAt })
      .from(postsTable)
      .where(eq(postsTable.id, postId));
    const createdAt = post?.createdAt;
    const ageMs = createdAt ? Date.now() - createdAt.getTime() : 0;
    if (createdAt && ageMs > 1000 * 60 * 2) {
      res.json({ status: "failed" as const, error: "AI analysis unavailable" });
      return;
    }
    res.json({ status: "pending" as const });
    return;
  }

  res.json({
    status: "done" as const,
    analysis: {
      hateSpeech: row.hateSpeech,
      sensationalismScore: row.sensationalismScore,
      credibilityAssessment: row.credibilityAssessment,
      verdict: row.verdict,
      createdAt: row.createdAt.toISOString(),
    },
  });
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const currentUser = await loadCurrentUser(req);
  if (currentUser) {
    await db
      .update(usersTable)
      .set({
        readCount: sql`${usersTable.readCount} + 1`,
      })
      .where(eq(usersTable.uid, currentUser.uid));
  }
  const [serialized] = await serializePosts([row], currentUser?.uid);
  res.json(GetPostResponse.parse(serialized));
});

router.post("/posts/:id/vote", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = VotePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = VotePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = req.user!;

  const [existingVote] = await db
    .select()
    .from(postVotesTable)
    .where(
      and(
        eq(postVotesTable.postId, params.data.id),
        eq(postVotesTable.userId, user.uid),
      ),
    );

  if (body.data.direction === "clear") {
    if (existingVote) {
      await db
        .delete(postVotesTable)
        .where(
          and(
            eq(postVotesTable.postId, params.data.id),
            eq(postVotesTable.userId, user.uid),
          ),
        );
      const field =
        existingVote.direction === "down"
          ? postsTable.downvotes
          : postsTable.upvotes;
      await db
        .update(postsTable)
        .set({
          [existingVote.direction === "down" ? "downvotes" : "upvotes"]: sql`${field} - 1`,
        })
        .where(eq(postsTable.id, params.data.id));
    }
  } else {
    const newDir = body.data.direction;
    if (!existingVote) {
      await db.insert(postVotesTable).values({
        postId: params.data.id,
        userId: user.uid,
        direction: newDir,
      });
      if (newDir === "up") {
        await db
          .update(postsTable)
          .set({ upvotes: sql`${postsTable.upvotes} + 1` })
          .where(eq(postsTable.id, params.data.id));
      } else {
        await db
          .update(postsTable)
          .set({ downvotes: sql`${postsTable.downvotes} + 1` })
          .where(eq(postsTable.id, params.data.id));
      }
    } else if (existingVote.direction !== newDir) {
      await db
        .update(postVotesTable)
        .set({ direction: newDir })
        .where(
          and(
            eq(postVotesTable.postId, params.data.id),
            eq(postVotesTable.userId, user.uid),
          ),
        );
      if (newDir === "up") {
        await db
          .update(postsTable)
          .set({
            upvotes: sql`${postsTable.upvotes} + 1`,
            downvotes: sql`${postsTable.downvotes} - 1`,
          })
          .where(eq(postsTable.id, params.data.id));
      } else {
        await db
          .update(postsTable)
          .set({
            upvotes: sql`${postsTable.upvotes} - 1`,
            downvotes: sql`${postsTable.downvotes} + 1`,
          })
          .where(eq(postsTable.id, params.data.id));
      }
    }
  }

  const [updated] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id));
  const [serialized] = await serializePosts([updated!], user.uid);
  res.json(VotePostResponse.parse(serialized));
});

router.post("/posts/:id/verify", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = VerifyPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = VerifyPostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const newStatus = body.data.status;
  if (existing.verificationStatus !== newStatus) {
    await db
      .update(postsTable)
      .set({ verificationStatus: newStatus })
      .where(eq(postsTable.id, params.data.id));

    const oldReward = VERIFICATION_REWARDS[existing.verificationStatus] ?? 0;
    const newReward = VERIFICATION_REWARDS[newStatus] ?? 0;
    const delta = newReward - oldReward;
    if (delta !== 0) {
      const reason =
        delta > 0
          ? `Post advanced to ${newStatus}`
          : `Post reverted to ${newStatus}`;
      await adjustReputation(existing.authorId, delta, reason);
    }
  }
  const [updated] = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, params.data.id));
  const [serialized] = await serializePosts([updated!], req.user!.uid);
  res.json(VerifyPostResponse.parse(serialized));
});

router.post("/posts/:id/save", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = SavePostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SavePostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = req.user!;
  if (body.data.saved) {
    await db
      .insert(savedPostsTable)
      .values({ postId: params.data.id, userId: user.uid })
      .onConflictDoNothing();
  } else {
    await db
      .delete(savedPostsTable)
      .where(
        and(
          eq(savedPostsTable.postId, params.data.id),
          eq(savedPostsTable.userId, user.uid),
        ),
      );
  }
  res.json(
    SavePostResponse.parse({ postId: params.data.id, saved: body.data.saved }),
  );
});

export default router;
