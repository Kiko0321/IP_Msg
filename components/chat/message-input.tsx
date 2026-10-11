"use client";

import { useRef, useState } from "react";
import { ATTACHMENT_ACCEPT, formatBytes, validateAttachmentFile } from "@/lib/validation/attachment";
import { MESSAGE_MAX, captionSchema, messageSchema } from "@/lib/validation/message";

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (content: string, file?: File) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    // MSG-39: with a file attached, the text is optional.
    const parsed = (file ? captionSchema : messageSchema).safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid message.");
      return;
    }
    setError(null);
    setValue("");
    setFile(null);
    if (file) onSend(parsed.data, file);
    else onSend(parsed.data);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!picked) return;
    const problem = validateAttachmentFile(picked);
    setError(problem);
    setFile(problem ? null : picked);
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
      {file && (
        <p className="flex items-center gap-2 self-start rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800">
          <span aria-hidden="true">📎</span>
          <span className="max-w-60 truncate">{file.name}</span>
          <span className="text-xs text-neutral-500">{formatBytes(file.size)}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label={`Remove ${file.name}`}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ✕
          </button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} onChange={onFileChange} className="hidden" aria-label="Attach a file" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Attach a file or image"
          title="Attach a file or image (up to 10 MB)"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
        >
          📎
        </button>
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
          disabled={disabled || (!value.trim() && !file)}
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
