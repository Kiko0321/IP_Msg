import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IP Messenger",
  description: "A modern messenger inspired by IP Messenger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
