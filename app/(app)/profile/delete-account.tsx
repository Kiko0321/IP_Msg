"use client";

import { useActionState, useState } from "react";
import { DELETE_CONFIRMATION } from "@/lib/validation/account";
import { deleteAccount, type DeleteAccountState } from "./account-actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700";

// MSG-44: the "Delete account" section of the profile page.
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  const [confirm, setConfirm] = useState("");

  return (
    <section
      aria-labelledby="delete-heading"
      className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-red-200 p-4 dark:border-red-900"
    >
      <h2 id="delete-heading" className="font-medium text-red-700 dark:text-red-400">
        Delete account
      </h2>
      <p className="text-sm text-neutral-500">
        Permanently deletes your profile, your messages and the files you sent, from every chat. Groups you own are handed to
        another member. This can&apos;t be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-400"
        >
          Delete my account…
        </button>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Your password
            <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Type {DELETE_CONFIRMATION} to confirm
            <input
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              className={inputClass}
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || confirm.trim() !== DELETE_CONFIRMATION}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete account permanently"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="px-3 py-1.5 text-sm text-neutral-500">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
