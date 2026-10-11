"use client";

import { useState } from "react";
import { MESSAGE_MAX } from "@/lib/validation/message";

// MSG-40: Edit and Delete for the user's own messages, behind a small "⋯" button.

export function MessageActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => Promise<string | undefined>;
}) {
  const [mode, setMode] = useState<"closed" | "menu" | "confirm">("closed");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setPending(true);
    const problem = await onDelete();
    setPending(false);
    setError(problem ?? null);
    setMode("closed");
  }

  const link = "rounded px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800";

  return (
    <div className="flex items-center gap-1 self-end text-xs text-neutral-500">
      {error && (
        <span role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      {mode === "closed" && (
        <button type="button" onClick={() => setMode("menu")} aria-label="Message options" className={link}>
          ⋯
        </button>
      )}
      {mode === "menu" && (
        <>
          <button
            type="button"
            onClick={() => {
              setMode("closed");
              onEdit();
            }}
            className={link}
          >
            Edit
          </button>
          <button type="button" onClick={() => setMode("confirm")} className={`${link} text-red-600 dark:text-red-400`}>
            Delete
          </button>
          <button type="button" onClick={() => setMode("closed")} aria-label="Close options" className={link}>
            ✕
          </button>
        </>
      )}
      {mode === "confirm" && (
        <>
          <span>Delete this message for everyone?</span>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className={`${link} font-medium text-red-600 dark:text-red-400`}
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button type="button" onClick={() => setMode("closed")} disabled={pending} className={link}>
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

export function MessageEditor({
  initial,
  allowEmpty,
  onSave,
  onCancel,
}: {
  initial: string;
  /** A message with a file may lose its text (MSG-39). */
  allowEmpty: boolean;
  onSave: (content: string) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const unchanged = value.trim() === initial.trim();
  const blocked = pending || unchanged || (!allowEmpty && !value.trim());

  async function save() {
    if (blocked) return unchanged ? onCancel() : undefined;
    setPending(true);
    const problem = await onSave(value.trim());
    setPending(false);
    if (problem) setError(problem);
    else onCancel();
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void save();
          }
        }}
        autoFocus
        maxLength={MESSAGE_MAX}
        aria-label="Edit message"
        className="min-h-10 w-64 max-w-full resize-none rounded-lg bg-white px-2 py-1 text-neutral-900 outline-none [field-sizing:content] dark:bg-neutral-900 dark:text-neutral-100"
      />
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
      <div className="flex justify-end gap-2 text-xs">
        <button type="button" onClick={onCancel} disabled={pending} className="opacity-80 hover:underline">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={blocked} className="font-medium hover:underline disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
