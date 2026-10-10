"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
  email?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function readCredentials(formData: FormData): { email: string; password?: string; error?: string } {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_PATTERN.test(email)) return { email, error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { email, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { email, password };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, error } = readCredentials(formData);
  if (error || !password) return { email, error };

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) return { email, error: authError.message };

  redirect("/");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, error } = readCredentials(formData);
  if (error || !password) return { email, error };

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return { email, error: "Enter a display name." };

  // The confirmation email links back to this app, wherever it is running.
  const origin = (await headers()).get("origin") ?? "";

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Kept in user metadata until the profile table exists (MSG-07).
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (authError) return { email, error: authError.message };

  // With "Confirm email" enabled in Supabase there is no session until the link is clicked.
  if (!data.session) {
    return { email, message: `Check ${email} for a confirmation link to finish signing up.` };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
