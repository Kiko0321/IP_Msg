"use client";

import Link from "next/link";

// Shown when a page below the root layout throws. Server errors arrive without details (by design);
// the Error ID matches the "digest" in the server log (see docs/observability.md).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-neutral-500">Please try again. If it keeps happening, share the error ID below.</p>
      {error.digest && (
        <p className="rounded-md bg-neutral-100 px-3 py-1 font-mono text-sm dark:bg-neutral-900">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Try again
        </button>
        <Link href="/" className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-700">
          Home
        </Link>
      </div>
    </main>
  );
}
