"use server";

import type { BagActionResult, BagData } from "@/lib/bag-types";
import type { AssistantBagRequest } from "@/lib/assistant-types";
import {
  addBagItemsForUser,
  addBagItemForUser,
  getBagForUser,
  getCurrentUserId,
  removeBagItemForUser,
  setBagItemQuantityForUser,
} from "@/lib/bag-service";

async function authenticatedUserId() {
  return getCurrentUserId();
}

export async function addBagItemsAction(items: AssistantBagRequest[]): Promise<BagActionResult> {
  const userId = await authenticatedUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to prepare your order." };
  return addBagItemsForUser(userId, items);
}

export async function getAssistantBagQuoteAction(): Promise<BagActionResult<BagData>> {
  const userId = await authenticatedUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to review your bag total." };
  const bag = await getBagForUser(userId);
  if (bag.items.some((item) => item.currency !== bag.currency)) {
    return { ok: false, code: "CURRENCY_MISMATCH", error: "Your bag contains more than one currency. Please resolve that in your bag before checkout." };
  }
  return { ok: true, data: bag };
}

export async function getBagSummaryAction(): Promise<BagActionResult<{ itemCount: number }>> {
  const userId = await authenticatedUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to view your bag." };
  const bag = await getBagForUser(userId);
  return { ok: true, data: { itemCount: bag.itemCount } };
}

export async function addBagItemAction(productSlug: string, quantity: number): Promise<BagActionResult> {
  const userId = await authenticatedUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to add items to your bag." };
  return addBagItemForUser(userId, productSlug, quantity);
}

export async function setBagItemQuantityAction(productSlug: string, quantity: number): Promise<BagActionResult> {
  const userId = await authenticatedUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to update your bag." };
  return setBagItemQuantityForUser(userId, productSlug, quantity);
}

export async function removeBagItemAction(productSlug: string): Promise<BagActionResult> {
  const userId = await authenticatedUserId();
  if (!userId) return { ok: false, code: "UNAUTHENTICATED", error: "Sign in to update your bag." };
  return removeBagItemForUser(userId, productSlug);
}
