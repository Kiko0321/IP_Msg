"use client";

import { useEffect } from "react";

// Registers public/sw.js, which shows an offline page when there's no connection (PWA).
// Production only, so the dev server's hot reload never goes through a worker.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app works the same without it, just without the offline page.
    });
  }, []);

  return null;
}
