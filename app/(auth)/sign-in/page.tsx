import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in · IP Messenger" };

const NOTICES: Record<string, string> = {
  "confirm-failed": "That confirmation link is invalid or has expired. Sign in, or sign up again.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <AuthForm mode="sign-in" notice={notice ? NOTICES[notice] : undefined} />;
}
