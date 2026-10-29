"use client";

import { useEffect } from "react";
import { useBagCount } from "@/app/cart-store";

export function RefreshBagCount() {
  const { refreshBagCount } = useBagCount();
  useEffect(() => { void refreshBagCount(); }, [refreshBagCount]);
  return null;
}
