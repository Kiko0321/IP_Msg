import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connectionInfo } from "@/lib/network";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Network · IP Messenger" };

// MSG-24: shows the signed-in user their own connection. Computed per request; never stored,
// never shown to anyone else. See docs/network-information.md.
export default async function NetworkPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  const info = connectionInfo(await headers());

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/profile" className="text-sm text-neutral-500 underline">
          ← Profile
        </Link>
        <h1 className="text-2xl font-bold">Your connection</h1>
        <p className="text-sm text-neutral-500">Only you can see this. It is not saved or shared with other users.</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <dt className="text-neutral-500">Public IP</dt>
        <dd className="font-mono break-all">{info.ip ?? "Unknown"}</dd>

        <dt className="text-neutral-500">Version</dt>
        <dd>{info.version ? `IPv${info.version}` : "–"}</dd>

        <dt className="text-neutral-500">LAN IP</dt>
        <dd>Not available. Browsers don&apos;t expose local network addresses.</dd>
      </dl>

      {info.isPrivate && (
        <p className="text-sm text-neutral-500">
          This is a private or local address, which is expected when the app runs on your own machine or network.
        </p>
      )}

      <section className="flex flex-col gap-2 text-sm text-neutral-500">
        <h2 className="font-medium text-foreground">Good to know</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>This is the address the server sees. With a VPN, proxy or mobile network it is that service&apos;s address, not your device&apos;s.</li>
          <li>Several people on the same Wi-Fi or carrier often share one public IP.</li>
          <li>It can change whenever you reconnect.</li>
        </ul>
      </section>
    </main>
  );
}
