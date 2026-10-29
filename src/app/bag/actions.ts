"use server";

import type { BagActionResult } from "@/lib/bag-types";
import {
  addBagItemForUser,
  getBagForUser,
  getCurrentUserId,
  removeBagItemForUser,
  setBagItemQuantityForUser,
} from "@/lib/bag-service";

async function authenticatedUserId() {
  return getCurrentUserId();
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
