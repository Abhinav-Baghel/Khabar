import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, usersTable, type UserRow } from "@workspace/db";

const COOKIE_NAME = "khabar_token";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const SECRET = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET must be set for JWT signing.");
}

export type AuthedRequest = Request & { user?: UserRow };

export interface JwtPayload {
  uid: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(uid: string): string {
  return jwt.sign({ uid } satisfies JwtPayload, SECRET as string, {
    expiresIn: "30d",
  });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function readToken(req: Request): string | undefined {
  const cookieToken = (req.cookies?.[COOKIE_NAME] as string | undefined) ??
    undefined;
  if (cookieToken) return cookieToken;
  const header = req.header("authorization") ?? req.header("Authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return undefined;
}

export async function loadCurrentUser(
  req: Request,
): Promise<UserRow | undefined> {
  const token = readToken(req);
  if (!token) return undefined;
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, SECRET as string) as JwtPayload;
  } catch {
    return undefined;
  }
  if (!payload?.uid) return undefined;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.uid, payload.uid));
  return user ?? undefined;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await loadCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.user = user;
  next();
}

export async function attachOptionalUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await loadCurrentUser(req);
  if (user) req.user = user;
  next();
}
