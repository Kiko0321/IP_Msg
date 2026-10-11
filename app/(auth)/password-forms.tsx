"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, updatePassword, type AuthState } from "./actions";
import { buttonClass, inputClass } from "./auth-form";

// MSG-31: step 1 of a password reset, asks for the account's email.
export function ForgotPasswordForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  const error = state.error ?? (state.message ? undefined : notice);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="text-sm text-neutral-500">Enter your account&apos;s email and we&apos;ll send you a link to choose a new password.</p>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className={inputClass}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-sm text-neutral-500">
        Remembered it?{" "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

// Step 2: the email link signed the user in; now they pick the new password.
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">Choose a new password</h1>

      <label className="flex flex-col gap-1 text-sm">
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
