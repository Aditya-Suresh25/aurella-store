import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { assistantSessions } from "@/db/schema";
import { db } from "@/lib/db";
import type { AssistantSessionState } from "@/lib/assistant-types";

export const ASSISTANT_SESSION_COOKIE = "aurel_assistant_session";
export const ASSISTANT_SESSION_TTL_MS = 30 * 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieToken(cookieHeader: string | null) {
  const entry = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ASSISTANT_SESSION_COOKIE}=`));
  const token = entry?.slice(ASSISTANT_SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : null;
}

export async function getAssistantSession(cookieHeader: string | null, userId: string | null, preferredToken?: string) {
  const existingToken = cookieToken(cookieHeader);
  const token = preferredToken ?? existingToken ?? randomBytes(32).toString("hex");
  const id = tokenHash(token);
  const now = new Date();
  const [row] = await db.select({ userId: assistantSessions.userId, state: assistantSessions.state })
    .from(assistantSessions).where(and(eq(assistantSessions.id, id), gt(assistantSessions.expiresAt, now))).limit(1);

  const ownerChanged = Boolean(row && row.userId !== null && row.userId !== userId);
  const state = row && !ownerChanged ? row.state as AssistantSessionState : { mode: "idle" as const };
  await db.insert(assistantSessions).values({
    id,
    userId,
    state,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + ASSISTANT_SESSION_TTL_MS),
  }).onConflictDoUpdate({
    target: assistantSessions.id,
    set: { userId, state, updatedAt: now, expiresAt: new Date(now.getTime() + ASSISTANT_SESSION_TTL_MS) },
  });
  return { id, token, state, setCookie: !existingToken || !row || ownerChanged };
}

export async function saveAssistantSession(id: string, userId: string | null, state: AssistantSessionState) {
  const now = new Date();
  await db.update(assistantSessions).set({ userId, state, updatedAt: now, expiresAt: new Date(now.getTime() + ASSISTANT_SESSION_TTL_MS) })
    .where(eq(assistantSessions.id, id));
}

export function assistantSessionCookie(token: string) {
  return `${ASSISTANT_SESSION_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(ASSISTANT_SESSION_TTL_MS / 1000)}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
