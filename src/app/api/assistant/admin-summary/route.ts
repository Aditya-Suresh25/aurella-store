import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { AiIncompleteResponseError, AiRequestTimeoutError, enforceAssistantLimit, getAdminDashboardSummary } from "@/lib/assistant-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user.id) return NextResponse.json({ error: "Sign in as an administrator." }, { status: 401 });
    const [account] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1);
    if (account?.role !== "admin") return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    if (!(await enforceAssistantLimit(`user:${session.user.id}`, true))) {
      return NextResponse.json({ error: "You’ve reached the assistant’s short-term request limit. Please try again later." }, { status: 429 });
    }
    return NextResponse.json(await getAdminDashboardSummary());
  } catch (error) {
    if (error instanceof AiIncompleteResponseError || (error instanceof Error && error.message === "AI_INCOMPLETE_RESPONSE")) {
      return NextResponse.json({ error: "The briefing could not be completed. Please try again." }, { status: 502 });
    }
    if (error instanceof AiRequestTimeoutError || (error instanceof Error && error.message === "AI_REQUEST_TIMEOUT")) {
      return NextResponse.json({ error: "The dashboard briefing took too long to generate. Please try again." }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "Dashboard summary unavailable.";
    return message.includes("usage limit")
      ? NextResponse.json({ error: message }, { status: 429 })
      : NextResponse.json({ error: "Dashboard summary is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
