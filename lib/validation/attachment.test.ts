// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ATTACHMENT_MAX_BYTES, attachmentPath, attachmentSchema, formatBytes, validateAttachmentFile } from "./attachment";

// MSG-39: what may be attached, and where it may live.

const CHAT = "22222222-2222-4222-8222-222222222222";
const OTHER_CHAT = "33333333-3333-4333-8333-333333333333";
const FILE = "0f0e0d0c-0b0a-4908-8706-050403020100";

describe("validateAttachmentFile", () => {
  it("accepts images, PDF and Office files up to 10 MB", () => {
    expect(validateAttachmentFile({ type: "image/png", size: ATTACHMENT_MAX_BYTES })).toBeNull();
    expect(validateAttachmentFile({ type: "application/pdf", size: 1 })).toBeNull();
    expect(
      validateAttachmentFile({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 5 }),
    ).toBeNull();
  });

  it("rejects other types, empty and oversized files", () => {
    expect(validateAttachmentFile({ type: "application/x-msdownload", size: 10 })).toMatch(/images, PDF/);
    expect(validateAttachmentFile({ type: "image/svg+xml", size: 10 })).toMatch(/images, PDF/);
    expect(validateAttachmentFile({ type: "image/png", size: 0 })).toMatch(/empty/);
    expect(validateAttachmentFile({ type: "image/png", size: ATTACHMENT_MAX_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe("attachmentSchema", () => {
  const valid = { path: `${CHAT}/${FILE}.pdf`, name: "report.pdf", type: "application/pdf", size: 1234 };

  it("accepts a new file in this conversation's folder", () => {
    expect(attachmentSchema(CHAT).safeParse(valid).success).toBe(true);
    expect(attachmentSchema(CHAT).safeParse({ ...valid, path: attachmentPath(CHAT, "application/pdf") }).success).toBe(true);
  });

  it.each([
    ["another conversation's folder", `${OTHER_CHAT}/${FILE}.pdf`],
    ["a path that climbs out", `${CHAT}/../${OTHER_CHAT}/${FILE}.pdf`],
    ["a nested path", `${CHAT}/x/${FILE}.pdf`],
    ["an extension that doesn't match the type", `${CHAT}/${FILE}.exe`],
  ])("rejects %s", (_label, path) => {
    expect(attachmentSchema(CHAT).safeParse({ ...valid, path }).success).toBe(false);
  });

  it("rejects bad names, sizes and types", () => {
    expect(attachmentSchema(CHAT).safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(attachmentSchema(CHAT).safeParse({ ...valid, size: ATTACHMENT_MAX_BYTES + 1 }).success).toBe(false);
    expect(attachmentSchema(CHAT).safeParse({ ...valid, type: "text/html", path: `${CHAT}/${FILE}.html` }).success).toBe(false);
  });
});

it("formats file sizes", () => {
  expect([formatBytes(900), formatBytes(2048), formatBytes(3 * 1024 * 1024)]).toEqual(["900 B", "2 KB", "3.0 MB"]);
});
