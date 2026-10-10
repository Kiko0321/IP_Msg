import type { Metadata } from "next";
import { PresenceProvider } from "@/components/presence/presence-provider";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "IP Messenger",
  description: "A modern messenger inspired by IP Messenger",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Signed-in users announce their presence on every page (MSG-23).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {userId ? <PresenceProvider userId={userId}>{children}</PresenceProvider> : children}
      </body>
    </html>
  );
}
