import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageInput } from "./message-input";

// MSG-39: attaching a file in the message box.

function pick(file: File) {
  return userEvent.upload(screen.getByLabelText("Attach a file"), file, { applyAccept: false });
}

describe("MessageInput attachments", () => {
  it("sends a file without text, then clears it", async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const photo = new File(["png"], "photo.png", { type: "image/png" });

    await pick(photo);
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("", photo);
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
  });

  it("can remove the chosen file", async () => {
    render(<MessageInput onSend={vi.fn()} />);
    await pick(new File(["x"], "notes.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove notes.txt" }));
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("refuses unsupported files", async () => {
    render(<MessageInput onSend={vi.fn()} />);
    await pick(new File(["MZ"], "setup.exe", { type: "application/x-msdownload" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/images, PDF/);
    expect(screen.queryByText("setup.exe")).not.toBeInTheDocument();
  });
});
