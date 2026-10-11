import { z } from "zod";

// MSG-43: mirrors public.reports (reason list, details length).
export const REPORT_REASONS = {
  spam: "Spam",
  harassment: "Harassment or bullying",
  inappropriate: "Inappropriate content",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export const REPORT_DETAILS_MAX = 1000;

export const reportSchema = z.object({
  userId: z.uuid("Unknown user."),
  messageId: z.uuid().optional(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]], "Choose a reason."),
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX, `Keep it under ${REPORT_DETAILS_MAX} characters.`)
    .transform((text) => text || undefined),
});

export type ReportInput = z.input<typeof reportSchema>;
