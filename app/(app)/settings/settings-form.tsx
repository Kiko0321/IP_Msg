"use client";

import { useActionState } from "react";
import { NotificationPermission } from "@/components/notifications/notification-permission";
import { THEMES, type Settings, type Theme } from "@/lib/validation/settings";
import { updateSettings, type SettingsState } from "./actions";

const THEME_LABELS: Record<Theme, string> = {
  system: "Match my device",
  light: "Light",
  dark: "Dark",
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updateSettings, {});
  // After a save, show what was saved; React resets uncontrolled fields to these defaults.
  const values = state.values ?? initial;

  return (
    <form action={formAction} key={JSON.stringify(values)} className="flex w-full max-w-md flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Theme</legend>
        {THEMES.map((theme) => (
          <label key={theme} className="flex items-center gap-2 text-sm">
            <input type="radio" name="theme" value={theme} defaultChecked={values.theme === theme} />
            {THEME_LABELS[theme]}
          </label>
        ))}
        {state.fieldErrors?.theme && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.fieldErrors.theme[0]}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Notifications</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifyNewMessages" defaultChecked={values.notifyNewMessages} />
          Notify me about new messages
        </label>
        <NotificationPermission />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifySound" defaultChecked={values.notifySound} />
          Play a sound for new messages
        </label>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.message && !pending && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
