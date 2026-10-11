"use client";

import { useState, useTransition } from "react";
import { reportUser } from "@/app/(app)/safety/actions";
import { REPORT_DETAILS_MAX, REPORT_REASONS, type ReportReason } from "@/lib/validation/report";

// MSG-43: report a person, or one of their messages.
export function ReportForm({
  userId,
  messageId,
  subject,
  onDone,
}: {
  userId: string;
  messageId?: string;
  /** What's being reported, e.g. "Bob" or "this message". */
  subject: string;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();

  if (result.message) {
    return (
      <div role="status" className="flex items-center justify-between gap-3 text-sm">
        <span>{result.message}</span>
        <button type="button" onClick={onDone} className="underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason) return;
        startTransition(async () => setResult(await reportUser({ userId, messageId, reason, details })));
      }}
      className="flex flex-col gap-2 text-sm"
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Report {subject}</legend>
        {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={REPORT_DETAILS_MAX}
        placeholder="Anything else we should know? (optional)"
        aria-label="Details"
        rows={2}
        className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
      />
      {result.error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {result.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} disabled={pending} className="px-2 py-1 text-neutral-500">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!reason || pending}
          className="rounded-md bg-red-600 px-3 py-1 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
