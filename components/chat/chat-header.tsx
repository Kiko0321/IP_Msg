import Link from "next/link";
import { Avatar } from "@/components/avatar";

export function ChatHeader({
  title,
  subtitle,
  avatarUrl,
}: {
  title: string;
  subtitle?: React.ReactNode;
  avatarUrl?: string | null;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <Link href="/chats" aria-label="Back to chats" className="rounded-md px-2 py-1 text-lg text-neutral-500 hover:bg-neutral-100 md:hidden dark:hover:bg-neutral-900">
        ←
      </Link>
      <Avatar name={title} url={avatarUrl} size="sm" />
      <div className="min-w-0">
        <h1 className="truncate font-semibold">{title}</h1>
        {subtitle && <div className="truncate text-xs text-neutral-500">{subtitle}</div>}
      </div>
    </header>
  );
}
