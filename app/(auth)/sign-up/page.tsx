import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up · IP Messenger" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
