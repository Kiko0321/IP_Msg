import { z } from "zod";

// Mirrors the messages.content check (1-4000 characters, not only whitespace).
export const MESSAGE_MAX = 4000;

export const messageSchema = z
  .string()
  .trim()
  .min(1, "Type a message.")
  .max(MESSAGE_MAX, `Messages can be at most ${MESSAGE_MAX} characters.`);

// MSG-39: with an attachment the text is optional (the database allows empty content then).
export const captionSchema = z
  .string()
  .trim()
  .max(MESSAGE_MAX, `Messages can be at most ${MESSAGE_MAX} characters.`);
