import type { Metadata } from "next";
import { ForgotPasswordForm } from "../password-forms";

export const metadata: Metadata = { title: "Forgot password · IP Messenger" };

const NOTICES: Record<string, string> = {
  "link-expired": "That reset link is invalid or has expired. Request a new one.",
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <ForgotPasswordForm notice={notice ? NOTICES[notice] : undefined} />;
}
