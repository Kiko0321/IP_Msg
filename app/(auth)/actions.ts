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

function readEmail(formData: FormData): { email: string; error?: string } {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? { email } : { email, error: "Enter a valid email address." };
}

function passwordError(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
}

function readCredentials(formData: FormData): { email: string; password?: string; error?: string } {
  const { email, error } = readEmail(formData);
  if (error) return { email, error };

  const password = String(formData.get("password") ?? "");
  const tooShort = passwordError(password);
  return tooShort ? { email, error: tooShort } : { email, password };
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

// MSG-31: emails a one-time link that signs the user in and lands on /reset-password.
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, error } = readEmail(formData);
  if (error) return { email, error };

  const origin = (await headers()).get("origin") ?? "";

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (authError) return { email, error: authError.message };

  // Same answer whether or not the account exists, so the form can't be used to look up emails.
  return { email, message: `If ${email} has an account, we've sent it a link to reset your password.` };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const tooShort = passwordError(password);
  if (tooShort) return { error: tooShort };
  if (password !== String(formData.get("confirmPassword") ?? "")) return { error: "Passwords don't match." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Your reset link has expired. Request a new one." };

  const { error: authError } = await supabase.auth.updateUser({ password });
  if (authError) return { error: authError.message };

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
