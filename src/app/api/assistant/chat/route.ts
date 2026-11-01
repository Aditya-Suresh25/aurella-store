import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assistantActionKeys, assistantSessions, categories, products } from "@/db/schema";
import { db } from "@/lib/db";
import { AI_REQUEST_TIMEOUT_MS, AiRequestTimeoutError, chatWithAurelAssistant, enforceAssistantLimit, validateAssistantMessage } from "@/lib/assistant-service";
import { assistantSessionCookie, ASSISTANT_SESSION_COOKIE, getAssistantSession, saveAssistantSession } from "@/lib/assistant-session";
import { addBagItemsForUser, getBagForUser } from "@/lib/bag-service";
import type { AssistantBagRequest, AssistantOrderPlan, AssistantSearchIntent, AssistantSessionState } from "@/lib/assistant-types";

export const runtime = "nodejs";

function requestIdentity(forwardedFor: string | null, realIp: string | null) {
  const ip = (forwardedFor?.split(",")[0] || realIp || "unknown").trim();
  return `ip:${createHash("sha256").update(ip).digest("hex")}`;
}

function sessionCookieToken(cookieHeader: string | null) {
  const entry = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ASSISTANT_SESSION_COOKIE}=`));
  const token = entry?.slice(ASSISTANT_SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const deadlineAt = requestStartedAt + AI_REQUEST_TIMEOUT_MS;
  const token = sessionCookieToken(request.headers.get("cookie"));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutResponse = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      console.info(JSON.stringify({ event: "aurel_ai_timing", feature: "chat", stage: "request_timeout", durationMs: Date.now() - requestStartedAt }));
      resolve(NextResponse.json({ error: "The assistant took too long to respond. Please try again." }, { status: 504 }));
    }, AI_REQUEST_TIMEOUT_MS);
  });
  const work = handleChatRequest(request, deadlineAt, requestStartedAt, token);
  try {
    const response = await Promise.race([work, timeoutResponse]);
    response.headers.append("Set-Cookie", assistantSessionCookie(token));
    return response;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function DELETE(request: Request) {
  const token = sessionCookieToken(request.headers.get("cookie"));
  const session = await auth.api.getSession({ headers: request.headers });
  const assistantSession = await getAssistantSession(request.headers.get("cookie"), session?.user.id ?? null, token);
  await saveAssistantSession(assistantSession.id, session?.user.id ?? null, { mode: "idle", history: [] });
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", assistantSessionCookie(token));
  return response;
}

async function handleChatRequest(request: Request, deadlineAt: number, requestStartedAt: number, token: string) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !validateAssistantMessage((body as { message?: unknown }).message)) {
      return NextResponse.json({ error: "Write a message of up to 2,000 characters." }, { status: 400 });
    }
    const requestBody = body as { message: string; continuation?: unknown; selectionSlug?: unknown };
    const message = requestBody.message.trim();
    const rawContinuation = requestBody.continuation;
    let continuation: { intent: AssistantSearchIntent; offset: number } | undefined;
    if (rawContinuation !== undefined) {
      if (!rawContinuation || typeof rawContinuation !== "object" || Array.isArray(rawContinuation)) {
        return NextResponse.json({ error: "This search page expired. Please search again." }, { status: 400 });
      }
      const value = rawContinuation as { intent?: unknown; offset?: unknown };
      if (!value.intent || typeof value.intent !== "object" || Array.isArray(value.intent) || !Number.isSafeInteger(value.offset)) {
        return NextResponse.json({ error: "This search page expired. Please search again." }, { status: 400 });
      }
      continuation = { intent: value.intent as AssistantSearchIntent, offset: Number(value.offset) };
    }
    const selectionSlug = typeof requestBody.selectionSlug === "string" && /^[a-z0-9-]{1,100}$/.test(requestBody.selectionSlug)
      ? requestBody.selectionSlug : undefined;
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user.id ?? null;
    const identity = userId ? `user:${userId}` : requestIdentity(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"));
    if (!(await enforceAssistantLimit(identity, Boolean(userId)))) {
      return NextResponse.json({ error: "You’ve reached the assistant’s short-term message limit. Please wait a few minutes and try again." }, { status: 429 });
    }
    const assistantSession = await getAssistantSession(request.headers.get("cookie"), userId, token);
    const state = assistantSession.state;
    const history = state.history ?? [];
    const isResumeRequest = /\b(?:resume|retry|check)\b/i.test(message);
    const retryingPreparedAdd = state.mode === "quote" && state.orderPlan?.autoAdd && state.history?.at(-1)?.role === "user" && state.history.at(-1)?.text === message;
    const resumeAdd = state.mode === "quote" && state.orderPlan?.autoAdd && (isResumeRequest || retryingPreparedAdd);
    const resumeCompleted = state.mode === "quote" && state.completedActionId && isResumeRequest && Boolean(userId);
    let result: Record<string, unknown>;
    let nextState: AssistantSessionState;
    if (resumeCompleted && userId) {
      result = { message: "Your bag is up to date. Here is the current total; say “place order” when you are ready to continue to payment.", quote: await getBagForUser(userId) };
      nextState = state;
    } else if (resumeAdd && state.orderPlan) {
      result = { message: state.orderPlan.message ?? "I’ll prepare those items and calculate your bag total.", orderPlan: state.orderPlan, sessionState: state };
      nextState = state;
    } else {
      const generated = await chatWithAurelAssistant(message, history, deadlineAt, continuation, state, selectionSlug);
      result = generated as unknown as Record<string, unknown>;
      nextState = (generated.sessionState as AssistantSessionState | undefined) ?? { mode: "idle" };
    }

    const orderPlan = result.orderPlan as AssistantOrderPlan | undefined;
    if (orderPlan?.autoAdd) {
      const requests: AssistantBagRequest[] = orderPlan.lines.map((line) => ({
        productSlug: line.selectedSlug ?? line.options[0]?.slug ?? "",
        quantity: line.quantity ?? 0,
      }));
      if (!userId) {
        result = { ...result, message: "Sign in to add these selected items. I’ll keep this order request for this chat." , requiresSignIn: true, pendingOrder: requests };
        nextState = { ...nextState, mode: "quote", orderPlan, actionId: nextState.actionId ?? randomBytes(16).toString("hex") };
      } else {
        const actionId = nextState.actionId ?? randomBytes(16).toString("hex");
        nextState = {
          ...nextState,
          mode: "quote",
          actionId,
          orderPlan,
          history: [...history, { role: "user" as const, text: message.slice(0, 500) }].slice(-10),
        };
        await saveAssistantSession(assistantSession.id, userId, nextState);
        const added = await addBagItemsForUser(userId, requests, actionId);
        if (!added.ok) {
          const refreshAvailability = added.code === "OUT_OF_STOCK" || added.code === "NOT_FOUND";
          const currentRows = refreshAvailability
            ? await db.select({ slug: products.slug, stockQuantity: products.stockQuantity })
              .from(products).innerJoin(categories, eq(products.categoryId, categories.id))
              .where(and(inArray(products.slug, requests.map((item) => item.productSlug)), eq(products.isActive, true), eq(categories.isActive, true)))
            : [];
          const stockBySlug = new Map(currentRows.map((row) => [row.slug, row.stockQuantity]));
          const updatedPlan = {
            ...orderPlan,
            autoAdd: false,
            lines: refreshAvailability ? orderPlan.lines.map((line) => {
              const options = line.options.map((product) => ({ ...product, stockQuantity: stockBySlug.get(product.slug) ?? 0 })).filter((product) => product.stockQuantity > 0);
              const selected = options.find((product) => product.slug === line.selectedSlug);
              return {
                ...line,
                options,
                selectedSlug: selected?.slug,
                quantity: selected && line.quantity && line.quantity > selected.stockQuantity ? undefined : line.quantity,
              };
            }) : orderPlan.lines,
          };
          const quantityIssue = updatedPlan.lines.find((line) => line.selectedSlug && !line.quantity);
          const matchIssue = updatedPlan.lines.find((line) => !line.selectedSlug);
          const messageWithError = added.code === "OUT_OF_STOCK" && quantityIssue
            ? `Availability changed. Nothing was added. There are now ${quantityIssue.options.find((product) => product.slug === quantityIssue.selectedSlug)?.stockQuantity ?? 0} available. How many would you like?`
            : matchIssue?.options.length === 0
              ? `Availability changed. Nothing was added; “${matchIssue.requestedTerm}” is no longer in stock. Choose another available match or skip this item.`
              : `I couldn’t add those items: ${added.error}`;
          result = { ...result, message: messageWithError, orderPlan: updatedPlan };
          nextState = { ...nextState, mode: quantityIssue ? "quantity" : "selecting", orderPlan: updatedPlan, actionId: undefined };
        } else {
          const quote = await getBagForUser(userId);
          result = { ...result, message: "Added the selected items. Here is the current total for your complete bag. Say “place order” when you are ready to continue to payment.", orderPlan: undefined, quote };
          nextState = { ...nextState, mode: "quote", orderPlan: undefined, actionId: undefined, completedActionId: actionId };
        }
      }
    }

    const assistantText = typeof result.message === "string" ? result.message : "I found a few pieces to explore.";
    nextState = {
      ...nextState,
      history: [...history, { role: "user" as const, text: message.slice(0, 500) }, { role: "assistant" as const, text: assistantText.slice(0, 700) }].slice(-10),
    };
    await saveAssistantSession(assistantSession.id, userId, nextState);
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await Promise.all([
        db.delete(assistantSessions).where(lt(assistantSessions.expiresAt, new Date())),
        db.delete(assistantActionKeys).where(lt(assistantActionKeys.createdAt, cutoff)),
      ]);
    }
    console.info(JSON.stringify({ event: "aurel_ai_timing", feature: "chat", stage: "request_complete", durationMs: Date.now() - requestStartedAt }));
    return NextResponse.json({ ...result, sessionState: undefined });
  } catch (error) {
    if (error instanceof AiRequestTimeoutError || (error instanceof Error && error.message === "AI_REQUEST_TIMEOUT")) {
      return NextResponse.json({ error: "The assistant took too long to respond. Please try again." }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "The assistant is unavailable right now. Please try again.";
    if (message.includes("usage limit")) return NextResponse.json({ error: message }, { status: 429 });
    console.error(JSON.stringify({ event: "aurel_ai_failure", feature: "chat", stage: "request", errorType: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({ error: "The assistant is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
