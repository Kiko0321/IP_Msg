import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatMember, DisplayMessage } from "@/lib/chat/types";
import { MessageList } from "./message-list";

// MSG-40: editing and deleting your own messages from the message list.

const members: Record<string, ChatMember> = {
  me: { user_id: "me", display_name: "Me", avatar_url: null },
  bob: { user_id: "bob", display_name: "Bob", avatar_url: null },
};
const at = "2026-10-12T10:00:00Z";
const messages: DisplayMessage[] = [
  { id: "1", sender_id: "bob", content: "hi", created_at: at, edited_at: null },
  { id: "2", sender_id: "me", content: "helo", created_at: at, edited_at: null },
];

type Result = Promise<string | undefined>;

function setup(overrides: { onEdit?: (m: DisplayMessage, content: string) => Result } = {}) {
  const onEdit = vi.fn(overrides.onEdit ?? (async () => undefined));
  const onDelete = vi.fn<(m: DisplayMessage) => Result>(async () => undefined);
  render(
    <MessageList messages={messages} members={members} currentUserId="me" showSenderNames={false} onEdit={onEdit} onDelete={onDelete} />,
  );
  return { onEdit, onDelete };
}

describe("message options", () => {
  it("are offered only on your own messages", () => {
    setup();
    expect(screen.getAllByRole("button", { name: "Message options" })).toHaveLength(1);
  });

  it("edit in place: Enter saves the trimmed text", async () => {
    const { onEdit } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Message options" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    const box = screen.getByRole("textbox", { name: "Edit message" });
    await userEvent.clear(box);
    await userEvent.type(box, " hello {Enter}");

    expect(onEdit).toHaveBeenCalledWith(messages[1], "hello");
    expect(screen.queryByRole("textbox", { name: "Edit message" })).not.toBeInTheDocument();
  });

  it("Escape cancels an edit", async () => {
    const { onEdit } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Message options" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Edit message" }), "x{Escape}");
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("helo")).toBeInTheDocument();
  });

  it("shows the error if saving fails and keeps the editor open", async () => {
    setup({ onEdit: async () => "Couldn't save the change. Try again." });
    await userEvent.click(screen.getByRole("button", { name: "Message options" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Edit message" }), "!{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save");
    expect(screen.getByRole("textbox", { name: "Edit message" })).toBeInTheDocument();
  });

  it("asks before deleting", async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Message options" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this message for everyone?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(messages[1]);
  });
});
