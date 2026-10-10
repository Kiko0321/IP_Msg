import type { Metadata } from "next";
import { PresenceProvider } from "@/components/presence/presence-provider";
import { ThemeSync } from "@/components/theme-sync";
import { getUserSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
  // Theme from user settings (MSG-22); signed-out visitors follow their device.
  const theme = userId ? (await getUserSettings(supabase, userId)).theme : "system";

  return (
    // The "dark" class is added on the client before paint, hence suppressHydrationWarning.
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeSync theme={theme} />
        {userId ? <PresenceProvider userId={userId}>{children}</PresenceProvider> : children}
      </body>
    </html>
  );
}
