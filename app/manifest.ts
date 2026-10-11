import type { MetadataRoute } from "next";

// Makes the app installable to the home screen / desktop (served at /manifest.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IP Messenger",
    short_name: "IP Msg",
    description: "A modern messenger inspired by IP Messenger",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
