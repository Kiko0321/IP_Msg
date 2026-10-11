"use client";

import { useState, useTransition } from "react";
import { blockUser, unblockUser } from "@/app/(app)/safety/actions";
import { ReportForm } from "./report-form";

// MSG-43: Block / Unblock and Report for the other person in a direct chat (header menu).
export function ChatSafety({ userId, name, blocked }: { userId: string; name: string; blocked: boolean }) {
  const [panel, setPanel] = useState<"closed" | "menu" | "confirm-block" | "report">("closed");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (!result.error) setPanel("closed");
    });
  }

  const item = "block w-full rounded px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800";

  return (
    <div className="ml-auto">
      <button
        type="button"
        onClick={() => setPanel(panel === "closed" ? "menu" : "closed")}
        aria-label="Chat options"
        aria-expanded={panel !== "closed"}
        className="rounded-md px-2 py-1 text-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
      >
        ⋯
      </button>
      {panel !== "closed" && (
        <div className="absolute top-full right-4 z-20 mt-1 w-72 rounded-lg border border-neutral-200 bg-background p-2 text-sm shadow-lg dark:border-neutral-800">
          {panel === "menu" && (
            <>
              {blocked ? (
                <button type="button" disabled={pending} onClick={() => run(() => unblockUser(userId))} className={item}>
                  Unblock {name}
                </button>
              ) : (
                <button type="button" onClick={() => setPanel("confirm-block")} className={item}>
                  Block {name}
                </button>
              )}
              <button type="button" onClick={() => setPanel("report")} className={`${item} text-red-600 dark:text-red-400`}>
                Report {name}
              </button>
            </>
          )}
          {panel === "confirm-block" && (
            <div className="flex flex-col gap-2 p-1">
              <p>
                Block {name}? Neither of you will be able to send messages in this chat or start a new one. {name} isn&apos;t told.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel("closed")} disabled={pending} className="px-2 py-1 text-neutral-500">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => run(() => blockUser(userId))}
                  disabled={pending}
                  className="rounded-md bg-red-600 px-3 py-1 font-medium text-white disabled:opacity-50"
                >
                  {pending ? "Blocking…" : "Block"}
                </button>
              </div>
            </div>
          )}
          {panel === "report" && (
            <div className="p-1">
              <ReportForm userId={userId} subject={name} onDone={() => setPanel("closed")} />
            </div>
          )}
          {error && (
            <p role="alert" className="p-1 text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
