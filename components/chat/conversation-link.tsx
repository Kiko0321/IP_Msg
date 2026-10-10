"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A conversation row that highlights itself while that chat is open.
export function ConversationLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
        active ? "bg-neutral-100 dark:bg-neutral-900" : ""
      }`}
    >
      {children}
    </Link>
  );
}
