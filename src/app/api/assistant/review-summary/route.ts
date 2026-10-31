import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AiRequestTimeoutError, enforceAssistantLimit, getProductReviewSummary } from "@/lib/assistant-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { slug?: unknown };
    if (typeof body.slug !== "string" || !/^[a-z0-9-]{1,100}$/.test(body.slug)) {
      return NextResponse.json({ error: "Choose a valid product." }, { status: 400 });
    }
    const session = await auth.api.getSession({ headers: request.headers });
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
    const identity = session?.user.id ? `user:${session.user.id}` : `ip:${createHash("sha256").update(forwarded).digest("hex")}`;
    if (!(await enforceAssistantLimit(identity, Boolean(session?.user.id)))) {
      return NextResponse.json({ error: "You’ve reached the assistant’s short-term message limit. Please try again later." }, { status: 429 });
    }
    return NextResponse.json(await getProductReviewSummary(body.slug));
  } catch (error) {
    if (error instanceof AiRequestTimeoutError || (error instanceof Error && error.message === "AI_REQUEST_TIMEOUT")) {
      return NextResponse.json({ error: "The review summary took too long to generate. Please try again." }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "Review summary unavailable.";
    return message.includes("usage limit")
      ? NextResponse.json({ error: message }, { status: 429 })
      : NextResponse.json({ error: "Review summary is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
