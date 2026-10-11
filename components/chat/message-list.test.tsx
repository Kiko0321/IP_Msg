import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatMember, DisplayMessage } from "@/lib/chat/types";
import { MessageList } from "./message-list";

describe("MessageList older messages (MSG-38)", () => {
  const members: Record<string, ChatMember> = { me: { user_id: "me", display_name: "Me", avatar_url: null } };
  const one: DisplayMessage[] = [
    { id: "1", sender_id: "me", content: "hi", created_at: "2026-10-11T10:00:00Z", edited_at: null },
  ];

  it("offers to load older messages", async () => {
    const onLoadOlder = vi.fn();
    render(<MessageList messages={one} members={members} currentUserId="me" showSenderNames={false} hasOlder onLoadOlder={onLoadOlder} />);
    await userEvent.click(screen.getByRole("button", { name: "Load older messages" }));
    expect(onLoadOlder).toHaveBeenCalledOnce();
  });

  it("shows progress while loading", () => {
    render(<MessageList messages={one} members={members} currentUserId="me" showSenderNames={false} hasOlder loadingOlder />);
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });

  it("marks the start of the conversation when there's nothing older", () => {
    render(<MessageList messages={one} members={members} currentUserId="me" showSenderNames={false} />);
    expect(screen.getByText("Start of the conversation")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("MessageList search result (MSG-41)", () => {
  const members: Record<string, ChatMember> = { me: { user_id: "me", display_name: "Me", avatar_url: null } };
  const one: DisplayMessage[] = [
    { id: "1", sender_id: "me", content: "hi", created_at: "2026-10-11T10:00:00Z", edited_at: null },
  ];

  it("highlights the message opened from search", () => {
    const { container } = render(
      <MessageList messages={one} members={members} currentUserId="me" showSenderNames={false} highlightId="1" />,
    );
    expect(container.querySelector('[data-message-id="1"]')?.className).toMatch(/bg-yellow/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says when the message is older than what's loaded", () => {
    render(<MessageList messages={one} members={members} currentUserId="me" showSenderNames={false} hasOlder highlightId="999" />);
    expect(screen.getByRole("status")).toHaveTextContent("further back");
  });
});

describe("MessageList receipt (MSG-42)", () => {
  it("shows the receipt under the given message", () => {
    const members: Record<string, ChatMember> = { me: { user_id: "me", display_name: "Me", avatar_url: null } };
    const one: DisplayMessage[] = [
      { id: "1", sender_id: "me", content: "hi", created_at: "2026-10-11T10:00:00Z", edited_at: null },
    ];
    render(
      <MessageList messages={one} members={members} currentUserId="me" showSenderNames={false} receipt={{ messageId: "1", label: "Seen" }} />,
    );
    expect(screen.getByText("Seen")).toBeInTheDocument();
  });
});
