// MSG-36: rules for new-message alerts, kept free of browser APIs so they can be unit-tested.
// The browser side is components/notifications/message-notifier.tsx.

export type IncomingMessage = {
  conversation_id: string;
  sender_id: string;
  content: string;
  attachment_name?: string | null;
};

export type ViewState = {
  /** Current path, e.g. "/chat/<id>". */
  pathname: string;
  /** The page is visible and its window has focus. */
  attentive: boolean;
};

/** Is the user already looking at this message's chat? Then it needs no alert. */
export function isViewing(message: IncomingMessage, view: ViewState) {
  return view.attentive && view.pathname === `/chat/${message.conversation_id}`;
}

/** Which alerts to give for a new message, given the user's settings. */
export function alertsFor(
  message: IncomingMessage,
  me: string,
  view: ViewState,
  settings: { notifyNewMessages: boolean; notifySound: boolean; permission: NotificationPermission | "unsupported" },
) {
  if (message.sender_id === me || isViewing(message, view)) return { notify: false, sound: false };
  return {
    notify: settings.notifyNewMessages && settings.permission === "granted",
    sound: settings.notifySound,
  };
}

const PREVIEW_LENGTH = 120;

/** Title and text of the system notification. Groups show "Sender in Group". */
export function notificationText(
  message: IncomingMessage,
  senderName: string,
  conversation: { kind: "direct" | "group"; title: string | null } | null,
) {
  const title = conversation?.kind === "group" ? `${senderName} in ${conversation.title || "a group"}` : senderName;
  // MSG-39: a file sent without text is announced by its name.
  const text = message.content.replace(/\s+/g, " ").trim() || (message.attachment_name ? `📎 ${message.attachment_name}` : "");
  return { title, body: text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text };
}
