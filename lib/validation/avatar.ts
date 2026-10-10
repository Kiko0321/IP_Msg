// Mirrors the "avatars" bucket settings (file_size_limit, allowed_mime_types).
export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!(file.type in AVATAR_TYPES)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size > AVATAR_MAX_BYTES) return "Image must be 2 MB or smaller.";
  return null;
}

// Avatar objects must sit in the owner's folder: <user id>/<file name>.
export function isOwnAvatarPath(userId: string, path: string) {
  const [folder, name, ...rest] = path.split("/");
  return folder === userId && rest.length === 0 && /^[\w-]+\.(jpg|png|webp)$/.test(name ?? "");
}
