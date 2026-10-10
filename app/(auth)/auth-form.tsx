"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

type Mode = "sign-in" | "sign-up";

const COPY = {
  "sign-in": {
    title: "Sign in",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "No account yet?",
    switchLink: "Create one",
    switchHref: "/sign-up",
  },
  "sign-up": {
    title: "Create your account",
    submit: "Sign up",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/sign-in",
  },
} as const;

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700";

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "sign-in" ? signIn : signUp,
    {},
  );
  const copy = COPY[mode];

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">{copy.title}</h1>

      {mode === "sign-up" && (
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input name="displayName" required maxLength={50} autoComplete="nickname" className={inputClass} />
        </label>
      )}

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

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {(state.message ?? notice) && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.message ?? notice}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? copy.pending : copy.submit}
      </button>

      <p className="text-sm text-neutral-500">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="underline">
          {copy.switchLink}
        </Link>
      </p>
    </form>
  );
}
