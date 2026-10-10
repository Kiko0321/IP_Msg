"use client";

import { useActionState, useState } from "react";
import { DISPLAY_NAME_MAX, STATUS_MESSAGE_MAX, type ProfileInput } from "@/lib/validation/profile";
import { updateProfile, type ProfileState } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 aria-invalid:border-red-500 dark:border-neutral-700";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-sm text-red-600 dark:text-red-400">
      {errors[0]}
    </p>
  );
}

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  // Controlled so React's post-action form reset doesn't wipe what the user typed.
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [statusMessage, setStatusMessage] = useState(initial.statusMessage);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          name="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          aria-invalid={Boolean(errors?.displayName)}
          aria-describedby="displayName-error"
          className={inputClass}
        />
        <FieldError id="displayName-error" errors={errors?.displayName} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="flex justify-between">
          Status message
          <span className="text-neutral-500">
            {statusMessage.length}/{STATUS_MESSAGE_MAX}
          </span>
        </span>
        <input
          name="statusMessage"
          value={statusMessage}
          onChange={(e) => setStatusMessage(e.target.value)}
          maxLength={STATUS_MESSAGE_MAX}
          placeholder="What are you up to?"
          aria-invalid={Boolean(errors?.statusMessage)}
          aria-describedby="statusMessage-error"
          className={inputClass}
        />
        <FieldError id="statusMessage-error" errors={errors?.statusMessage} />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.message && !pending && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
