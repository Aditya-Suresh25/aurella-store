import type { Metadata } from "next";
import { AuthPage } from "@/app/auth-page";

export const metadata: Metadata = {
  title: "Sign in — Aurel",
  description: "Sign in to your Aurel account.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthPage mode="sign-in" searchParams={await searchParams} />;
}
