"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET, AVATAR_TYPES, validateAvatarFile } from "@/lib/validation/avatar";
import { removeAvatar, setAvatar } from "./actions";

export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again
    if (!file) return;

    const problem = validateAvatarFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    startTransition(async () => {
      // A new name per upload so browsers and the CDN never show a cached old image.
      const path = `${userId}/${crypto.randomUUID()}.${AVATAR_TYPES[file.type]}`;
      const { error: uploadError } = await createClient()
        .storage.from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await setAvatar(path);
      if (result.error) setError(result.error);
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex w-full max-w-md items-center gap-4">
      <Avatar name={name} url={url} size="lg" />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-neutral-700"
          >
            {pending ? "Saving…" : url ? "Change avatar" : "Upload avatar"}
          </button>
          {url && (
            <button
              type="button"
              disabled={pending}
              onClick={onRemove}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500 underline disabled:opacity-60"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-500">JPEG, PNG or WebP, up to 2 MB.</p>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(AVATAR_TYPES).join(",")}
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}
