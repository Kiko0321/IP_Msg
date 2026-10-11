import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatMember, DisplayMessage } from "@/lib/chat/types";
import { MESSAGE_MAX } from "@/lib/validation/message";
import { Avatar } from "./avatar";
import { MessageInput } from "./chat/message-input";
import { MessageList } from "./chat/message-list";

describe("Avatar", () => {
  it("shows initials when there is no picture", () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace's avatar" })).toHaveTextContent("AL");
  });

  it("uses the first two letters of a single name", () => {
    render(<Avatar name="bob" />);
    expect(screen.getByRole("img")).toHaveTextContent("BO");
  });
});

describe("MessageInput (MSG-17)", () => {
  function setup() {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    return { onSend, box: screen.getByRole("textbox", { name: "Message" }), user: userEvent.setup() };
  }

  it("sends the trimmed message on Enter and clears the box", async () => {
    const { onSend, box, user } = setup();
    await user.type(box, "  hello  {Enter}");

    expect(onSend).toHaveBeenCalledWith("hello");
    expect(box).toHaveValue("");
  });

  it("adds a new line on Shift+Enter instead of sending", async () => {
    const { onSend, box, user } = setup();
    await user.type(box, "line 1{Shift>}{Enter}{/Shift}line 2");

    expect(onSend).not.toHaveBeenCalled();
    expect(box).toHaveValue("line 1\nline 2");
  });

  it("doesn't send blank messages", async () => {
    const { onSend, box, user } = setup();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.type(box, "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Type a message.");
  });

  it("limits input to the maximum length", () => {
    setup();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute("maxLength", String(MESSAGE_MAX));
  });
});

describe("MessageList (MSG-16)", () => {
  const me = "user-me";
  const members: Record<string, ChatMember> = {
    [me]: { user_id: me, display_name: "Me", avatar_url: null },
    "user-bob": { user_id: "user-bob", display_name: "Bob", avatar_url: null },
  };
  const message = (id: string, sender: string, content: string, at: string, extra: Partial<DisplayMessage> = {}) => ({
    id,
    sender_id: sender,
    content,
    created_at: at,
    edited_at: null,
    ...extra,
  });

  it("renders messages in the given chronological order", () => {
    render(
      <MessageList
        currentUserId={me}
        members={members}
        showSenderNames={false}
        messages={[
          message("1", "user-bob", "first", "2026-10-10T10:00:00Z"),
          message("2", me, "second", "2026-10-10T10:01:00Z"),
          message("3", "user-bob", "third", "2026-10-10T10:02:00Z"),
        ]}
      />,
    );
    const texts = screen.getAllByText(/first|second|third/).map((el) => el.textContent);
    expect(texts).toEqual(["first", "second", "third"]);
  });

  it("shows sender names only in groups and not for own messages", () => {
    const messages = [message("1", "user-bob", "hi", "2026-10-10T10:00:00Z"), message("2", me, "hey", "2026-10-10T10:01:00Z")];

    const { rerender } = render(<MessageList currentUserId={me} members={members} showSenderNames messages={messages} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Me")).not.toBeInTheDocument();

    rerender(<MessageList currentUserId={me} members={members} showSenderNames={false} messages={messages} />);
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("marks sending and failed messages", () => {
    render(
      <MessageList
        currentUserId={me}
        members={members}
        showSenderNames={false}
        messages={[
          message("a", me, "pending", "2026-10-10T10:00:00Z", { status: "sending" }),
          message("b", me, "broken", "2026-10-10T10:01:00Z", { status: "failed" }),
        ]}
      />,
    );
    expect(screen.getByText(/Sending…/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Not sent");
  });

  it("shows an empty state", () => {
    render(<MessageList currentUserId={me} members={members} showSenderNames={false} messages={[]} />);
    expect(screen.getByText("No messages yet. Say hello!")).toBeInTheDocument();
  });
});

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
