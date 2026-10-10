import Image from "next/image";

const SIZES = { sm: 32, md: 48, lg: 96 } as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof SIZES;
}) {
  const px = SIZES[size];

  if (url) {
    return (
      <Image
        src={url}
        alt={`${name}'s avatar`}
        width={px}
        height={px}
        className="shrink-0 rounded-full object-cover"
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <span
      aria-label={`${name}'s avatar`}
      role="img"
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      style={{ width: px, height: px, fontSize: px * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
