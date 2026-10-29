import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BagClient } from "@/app/bag/bag-client";
import { getBagForUser, getCurrentUserId } from "@/lib/bag-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your bag — Aurel",
  description: "Review the pieces in your Aurel bag.",
};

export default async function BagPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in?returnTo=%2Fbag");
  const bag = await getBagForUser(userId);

  return <BagClient initialBag={bag} />;
}
