import { z } from "zod";

// MSG-39: message attachments. Mirrors the "attachments" bucket (size, types) and the
// messages_attachment_complete check in supabase/migrations/20261012000000_message_attachments.sql.
export const ATTACHMENT_BUCKET = "attachments";
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_NAME_MAX = 200;

export const ATTACHMENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** The file picker's `accept` list. */
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES).join(",");

export function isImage(type: string | null | undefined) {
  return Boolean(type?.startsWith("image/"));
}

export function validateAttachmentFile(file: { type: string; size: number }): string | null {
  if (!(file.type in ATTACHMENT_TYPES)) return "You can send images, PDF, text, ZIP and Office files.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > ATTACHMENT_MAX_BYTES) return "Files can be up to 10 MB.";
  return null;
}

/** Where a new upload goes: <conversation id>/<random uuid>.<ext>. */
export function attachmentPath(conversationId: string, type: string) {
  return `${conversationId}/${crypto.randomUUID()}.${ATTACHMENT_TYPES[type]}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The attachment a client says it uploaded, checked before it's saved with a message. */
export function attachmentSchema(conversationId: string) {
  return z
    .object({
      path: z.string(),
      name: z.string().trim().min(1).max(ATTACHMENT_NAME_MAX),
      type: z.string().refine((type) => type in ATTACHMENT_TYPES, "Unsupported file type."),
      size: z.number().int().min(1).max(ATTACHMENT_MAX_BYTES),
    })
    .refine(
      (a) => new RegExp(`^${conversationId}/${UUID}\\.${ATTACHMENT_TYPES[a.type]}$`, "i").test(a.path),
      "Invalid attachment.",
    );
}

export type AttachmentInput = { path: string; name: string; type: string; size: number };

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
