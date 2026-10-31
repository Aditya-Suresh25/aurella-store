import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AI_REQUEST_TIMEOUT_MS, AiRequestTimeoutError, chatWithAurelAssistant, enforceAssistantLimit, validateAssistantMessage } from "@/lib/assistant-service";

export const runtime = "nodejs";

function requestIdentity(forwardedFor: string | null, realIp: string | null) {
  const ip = (forwardedFor?.split(",")[0] || realIp || "unknown").trim();
  return `ip:${createHash("sha256").update(ip).digest("hex")}`;
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const deadlineAt = requestStartedAt + AI_REQUEST_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutResponse = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      console.info(JSON.stringify({ event: "aurel_ai_timing", feature: "chat", stage: "request_timeout", durationMs: Date.now() - requestStartedAt }));
      resolve(NextResponse.json({ error: "The assistant took too long to respond. Please try again." }, { status: 504 }));
    }, AI_REQUEST_TIMEOUT_MS);
  });
  const work = handleChatRequest(request, deadlineAt, requestStartedAt);
  try {
    return await Promise.race([work, timeoutResponse]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handleChatRequest(request: Request, deadlineAt: number, requestStartedAt: number) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !validateAssistantMessage((body as { message?: unknown }).message)) {
      return NextResponse.json({ error: "Write a message of up to 2,000 characters." }, { status: 400 });
    }
    const message = (body as { message: string }).message;
    const rawHistory = (body as { history?: unknown }).history;
    const history = Array.isArray(rawHistory) ? rawHistory.slice(-6).flatMap((turn) => {
      if (!turn || typeof turn !== "object") return [];
      const item = turn as { role?: unknown; text?: unknown };
      if ((item.role !== "user" && item.role !== "assistant") || typeof item.text !== "string") return [];
      return [{ role: item.role as "user" | "assistant", text: item.text.slice(0, 900) }];
    }) : [];
    const session = await auth.api.getSession({ headers: request.headers });
    const identity = session?.user.id ? `user:${session.user.id}` : requestIdentity(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
    if (!(await enforceAssistantLimit(identity, Boolean(session?.user.id)))) {
      return NextResponse.json({ error: "You’ve reached the assistant’s short-term message limit. Please wait a few minutes and try again." }, { status: 429 });
    }
    const result = await chatWithAurelAssistant(message, history, deadlineAt);
    console.info(JSON.stringify({ event: "aurel_ai_timing", feature: "chat", stage: "request_complete", durationMs: Date.now() - requestStartedAt }));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiRequestTimeoutError || (error instanceof Error && error.message === "AI_REQUEST_TIMEOUT")) {
      return NextResponse.json({ error: "The assistant took too long to respond. Please try again." }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "The assistant is unavailable right now. Please try again.";
    if (message.includes("usage limit")) return NextResponse.json({ error: message }, { status: 429 });
    return NextResponse.json({ error: "The assistant is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
