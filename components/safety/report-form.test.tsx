import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// MSG-43: the report form.

const reportUser = vi.fn(async () => ({ message: "Thanks. Your report was sent." }));
vi.mock("@/app/(app)/safety/actions", () => ({ reportUser: (...args: unknown[]) => reportUser(...(args as [])) }));

const { ReportForm } = await import("./report-form");

describe("ReportForm", () => {
  it("needs a reason, sends the report and confirms", async () => {
    render(<ReportForm userId="u1" messageId="m1" subject="this message" onDone={vi.fn()} />);
    const send = screen.getByRole("button", { name: "Send report" });
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole("radio", { name: "Spam" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Details" }), "buy now");
    await userEvent.click(send);

    expect(reportUser).toHaveBeenCalledWith({ userId: "u1", messageId: "m1", reason: "spam", details: "buy now" });
    expect(await screen.findByRole("status")).toHaveTextContent("report was sent");
  });
});
