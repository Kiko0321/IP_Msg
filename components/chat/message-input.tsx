"use client";

import { useRef, useState } from "react";
import { MESSAGE_MAX, messageSchema } from "@/lib/validation/message";

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const parsed = messageSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid message.");
      return;
    }
    setError(null);
    setValue("");
    onSend(parsed.data);
  }

  const nearLimit = value.length > MESSAGE_MAX - 200;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-1 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800"
    >
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter adds a new line. Ignore Enter while an IME is composing.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={MESSAGE_MAX}
          placeholder="Write a message…"
          aria-label="Message"
          disabled={disabled}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-2xl border border-neutral-300 bg-transparent px-4 py-2 outline-none [field-sizing:content] focus:border-neutral-500 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Send
        </button>
      </div>
      {nearLimit && (
        <p className="self-end text-xs text-neutral-500">
          {value.length}/{MESSAGE_MAX}
        </p>
      )}
    </form>
  );
}
