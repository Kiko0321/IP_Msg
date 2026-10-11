import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { Avatar } from "@/components/avatar";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageNotifier } from "@/components/notifications/message-notifier";
import { MobileNav, SidebarNav } from "@/components/shell/nav";
import { getUserSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

// MSG-20: app shell for signed-in pages.
// - md and up: sidebar (navigation, conversation list, current user) next to the content.
// - below md: one screen at a time with a bottom tab bar; /chats shows the list full width.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  const me = data.claims.sub;

  const [{ data: profile }, settings] = await Promise.all([
    supabase.from("profiles").select("display_name, status_message, avatar_url").eq("id", me).maybeSingle(),
    getUserSettings(supabase, me),
  ]);
  const name = profile?.display_name ?? data.claims.email ?? "You";

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* MSG-36: new-message notifications and sound, live sidebar updates. */}
      <MessageNotifier userId={me} notifyNewMessages={settings.notifyNewMessages} notifySound={settings.notifySound} />
      <aside className="hidden w-80 shrink-0 flex-col border-r border-neutral-200 md:flex lg:w-96 dark:border-neutral-800">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Link href="/chats" className="text-lg font-bold">
            IP Messenger
          </Link>
          <Link
            href="/contacts"
            className="rounded-md bg-neutral-900 px-2.5 py-1 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            New chat
          </Link>
        </div>
        <SidebarNav />
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-neutral-200 dark:border-neutral-800">
          <ConversationList supabase={supabase} me={me} />
        </div>
        <div className="flex items-center gap-3 border-t border-neutral-200 p-3 dark:border-neutral-800">
          <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={name} url={profile?.avatar_url} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name}</span>
              {profile?.status_message && (
                <span className="block truncate text-xs text-neutral-500">{profile.status_message}</span>
              )}
            </span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <MobileNav />
      </div>
    </div>
  );
}
