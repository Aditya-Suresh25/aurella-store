import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in?returnTo=%2Fadmin");
  const [account] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.user.id)).limit(1);
  if (account?.role !== "admin") redirect("/");
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}
