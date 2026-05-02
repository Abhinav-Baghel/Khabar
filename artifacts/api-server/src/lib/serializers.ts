import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  postsTable,
  postVotesTable,
  savedPostsTable,
  usersTable,
  type PostRow,
  type UserRow,
} from "@workspace/db";

export function serializePublicUser(
  row: UserRow,
  opts: { postCount: number; verifiedCount: number },
) {
  return {
    uid: row.uid,
    username: row.username,
    displayName: row.displayName,
    photoUrl: row.photoUrl ?? null,
    currentReputationScore: row.currentReputationScore,
    state: row.state,
    district: row.district,
    locality: row.locality,
    readCount: row.readCount ?? 0,
    postCount: opts.postCount,
    verifiedCount: opts.verifiedCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeCurrentUser(
  row: UserRow,
  opts: { postCount: number; verifiedCount: number },
) {
  return {
    ...serializePublicUser(row, opts),
    email: row.email,
    phoneNumber: row.phoneNumber ?? null,
    isEmailVerified: row.isEmailVerified,
    isPhoneVerified: row.isPhoneVerified,
  };
}

export async function getUserCounts(
  uid: string,
): Promise<{ postCount: number; verifiedCount: number }> {
  const [row] = await db
    .select({
      postCount: sql<number>`count(*)::int`,
      verifiedCount: sql<number>`count(*) filter (where ${postsTable.verificationStatus} in ('community','editor','verified'))::int`,
    })
    .from(postsTable)
    .where(eq(postsTable.authorId, uid));
  return {
    postCount: row?.postCount ?? 0,
    verifiedCount: row?.verifiedCount ?? 0,
  };
}

export async function getUserCountsBatch(
  uids: string[],
): Promise<Map<string, { postCount: number; verifiedCount: number }>> {
  const map = new Map<string, { postCount: number; verifiedCount: number }>();
  if (uids.length === 0) return map;
  const rows = await db
    .select({
      authorId: postsTable.authorId,
      postCount: sql<number>`count(*)::int`,
      verifiedCount: sql<number>`count(*) filter (where ${postsTable.verificationStatus} in ('community','editor','verified'))::int`,
    })
    .from(postsTable)
    .where(inArray(postsTable.authorId, uids))
    .groupBy(postsTable.authorId);
  for (const r of rows) {
    map.set(r.authorId, {
      postCount: r.postCount,
      verifiedCount: r.verifiedCount,
    });
  }
  for (const uid of uids) {
    if (!map.has(uid)) map.set(uid, { postCount: 0, verifiedCount: 0 });
  }
  return map;
}

export type SerializedPost = {
  id: number;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPhotoUrl: string | null;
  authorReputation: number;
  headline: string;
  details: string;
  category: string;
  isBreaking: boolean;
  location: { lat: number; lng: number; neighborhood: string };
  verificationStatus: string;
  upvotes: number;
  downvotes: number;
  savedByCurrentUser: boolean;
  currentUserVote: "up" | "down" | "none";
  createdAt: string;
};

export async function serializePosts(
  rows: PostRow[],
  currentUid: string | undefined,
): Promise<SerializedPost[]> {
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
  const postIds = rows.map((r) => r.id);

  const authors = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.uid, authorIds));
  const authorMap = new Map(authors.map((a) => [a.uid, a]));

  let savedSet = new Set<number>();
  let voteMap = new Map<number, "up" | "down">();
  if (currentUid) {
    const saved = await db
      .select({ postId: savedPostsTable.postId })
      .from(savedPostsTable)
      .where(
        and(
          eq(savedPostsTable.userId, currentUid),
          inArray(savedPostsTable.postId, postIds),
        ),
      );
    savedSet = new Set(saved.map((s) => s.postId));

    const votes = await db
      .select({
        postId: postVotesTable.postId,
        direction: postVotesTable.direction,
      })
      .from(postVotesTable)
      .where(
        and(
          eq(postVotesTable.userId, currentUid),
          inArray(postVotesTable.postId, postIds),
        ),
      );
    voteMap = new Map(
      votes.map((v) => [v.postId, v.direction === "down" ? "down" : "up"]),
    );
  }

  return rows.map((p) => {
    const a = authorMap.get(p.authorId);
    return {
      id: p.id,
      authorId: p.authorId,
      authorUsername: a?.username ?? "unknown",
      authorName: a?.displayName ?? "Unknown reporter",
      authorPhotoUrl: a?.photoUrl ?? null,
      authorReputation: a?.currentReputationScore ?? 0,
      headline: p.headline,
      details: p.details,
      category: p.category,
      isBreaking: p.isBreaking,
      location: { lat: p.lat, lng: p.lng, neighborhood: p.neighborhood },
      verificationStatus: p.verificationStatus,
      upvotes: p.upvotes,
      downvotes: p.downvotes,
      savedByCurrentUser: savedSet.has(p.id),
      currentUserVote: voteMap.get(p.id) ?? "none",
      createdAt: p.createdAt.toISOString(),
    };
  });
}
