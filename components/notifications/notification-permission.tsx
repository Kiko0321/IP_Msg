"use client";

import { useReducer, useSyncExternalStore } from "react";

type Permission = NotificationPermission | "unsupported" | "unknown";

const readPermission = (): Permission => ("Notification" in window ? Notification.permission : "unsupported");

// Re-render when the user changes the permission in the browser's site settings.
function subscribe(onChange: () => void) {
  let status: PermissionStatus | undefined;
  navigator.permissions
    ?.query({ name: "notifications" })
    .then((s) => {
      status = s;
      s.addEventListener("change", onChange);
    })
    .catch(() => {});
  return () => status?.removeEventListener("change", onChange);
}

// MSG-36: shows whether this browser may show notifications, with a button to ask. Permission is
// per browser/device (not per account), so it sits next to the saved setting rather than in it.
export function NotificationPermission() {
  // "unknown" while rendering on the server, where there's no browser to ask.
  const permission = useSyncExternalStore(subscribe, readPermission, () => "unknown" as const);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  async function ask() {
    await Notification.requestPermission();
    rerender();
  }

  if (permission === "unknown") return null;

  return (
    <div className="ml-6 text-sm text-neutral-500" aria-live="polite">
      {permission === "granted" && <p>✓ Notifications are allowed on this device.</p>}
      {permission === "default" && (
        <p className="flex flex-wrap items-center gap-2">
          This device hasn&apos;t allowed notifications yet.
          <button
            type="button"
            onClick={ask}
            className="rounded-md border border-neutral-300 px-2 py-0.5 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          >
            Allow notifications
          </button>
        </p>
      )}
      {permission === "denied" && (
        <p>Notifications are blocked for this site. Allow them in your browser&apos;s site settings.</p>
      )}
      {permission === "unsupported" && <p>This browser can&apos;t show notifications.</p>}
    </div>
  );
}
