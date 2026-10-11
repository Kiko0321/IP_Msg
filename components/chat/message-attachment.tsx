"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_BUCKET, formatBytes, isImage } from "@/lib/validation/attachment";

// MSG-39: an image (shown inline) or a file (download card) attached to a message. Files are in a
// private bucket, so they're opened through signed URLs that expire after an hour; RLS only signs
// them for members of the conversation.

const URL_TTL_SECONDS = 60 * 60;
// Signed URLs already fetched in this tab, so re-renders and scrolling don't ask again.
const signedUrls = new Map<string, Promise<string | null>>();

function signedUrl(path: string, download?: string) {
  const key = `${path}|${download ?? ""}`;
  if (!signedUrls.has(key)) {
    signedUrls.set(
      key,
      createClient()
        .storage.from(ATTACHMENT_BUCKET)
        .createSignedUrl(path, URL_TTL_SECONDS, download ? { download } : undefined)
        .then(({ data }) => data?.signedUrl ?? null),
    );
    // Forget it shortly before it expires.
    setTimeout(() => signedUrls.delete(key), (URL_TTL_SECONDS - 60) * 1000);
  }
  return signedUrls.get(key)!;
}

export function MessageAttachment({
  path,
  name,
  type,
  size,
  localFile,
  mine,
}: {
  path?: string | null;
  name: string;
  type: string;
  size: number;
  /** The sender's own file while it uploads: previewed from memory. */
  localFile?: File;
  mine: boolean;
}) {
  const image = isImage(type);
  const [signed, setSigned] = useState<string | null>(null);

  // The sender's own file is shown from memory while it uploads.
  const localUrl = useMemo(() => (localFile ? URL.createObjectURL(localFile) : null), [localFile]);
  useEffect(() => () => void (localUrl && URL.revokeObjectURL(localUrl)), [localUrl]);

  useEffect(() => {
    if (!path || localFile) return;
    let active = true;
    void signedUrl(path, image ? undefined : name).then((url) => active && setSigned(url));
    return () => {
      active = false;
    };
  }, [path, name, image, localFile]);

  const url = localUrl ?? signed;

  if (image) {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs can't go through next/image */}
        <img src={url} alt={name} className="max-h-72 max-w-full rounded-lg object-contain" />
      </a>
    ) : (
      <div className="h-40 w-56 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" aria-label={`Loading ${name}`} />
    );
  }

  return (
    <a
      href={url ?? undefined}
      download={name}
      aria-disabled={!url}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
        mine ? "bg-white/10 dark:bg-black/10" : "bg-white dark:bg-neutral-900"
      } ${url ? "" : "pointer-events-none opacity-60"}`}
    >
      <span aria-hidden="true" className="text-2xl">
        📄
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block text-xs opacity-70">{formatBytes(size)}</span>
      </span>
    </a>
  );
}
