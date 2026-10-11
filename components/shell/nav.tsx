"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/chats", label: "Chats", match: ["/chats", "/chat/"] },
  { href: "/contacts", label: "Contacts", match: ["/contacts", "/groups"] },
  { href: "/profile", label: "Profile", match: ["/profile", "/network"] },
  { href: "/settings", label: "Settings", match: ["/settings"] },
] as const;

function useActive() {
  const pathname = usePathname();
  return (match: readonly string[]) => match.some((m) => pathname === m || pathname.startsWith(m.endsWith("/") ? m : `${m}/`));
}

// Desktop: horizontal links at the top of the sidebar.
export function SidebarNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="flex gap-1 px-3 pb-3">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.match) ? "page" : undefined}
          className="rounded-md px-2.5 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white dark:text-neutral-300 dark:hover:bg-neutral-900 dark:aria-[current=page]:bg-neutral-100 dark:aria-[current=page]:text-neutral-900"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// Mobile: bottom tab bar. Hidden inside a conversation so the message input has the space.
export function MobileNav() {
  const isActive = useActive();
  if (usePathname().startsWith("/chat/")) return null;

  return (
    <nav
      aria-label="Main"
      className="grid shrink-0 grid-cols-4 border-t border-neutral-200 bg-background pb-[env(safe-area-inset-bottom)] md:hidden dark:border-neutral-800"
    >
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.match) ? "page" : undefined}
          className="py-3 text-center text-sm text-neutral-500 aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
