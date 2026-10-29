import type { Metadata } from "next";
import { AuthPage } from "@/app/auth-page";

export const metadata: Metadata = {
  title: "Create an account — Aurel",
  description: "Create an account with Aurel.",
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthPage mode="sign-up" searchParams={await searchParams} />;
}
