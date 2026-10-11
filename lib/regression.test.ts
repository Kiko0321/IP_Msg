// @vitest-environment node
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { prefersDark } from "./theme";
import { isOwnAvatarPath, validateAvatarFile, AVATAR_MAX_BYTES } from "./validation/avatar";

// Regression tests for small rules other features rely on: avatar uploads (MSG-09),
// theme choice (MSG-22) and the installable-app manifest (MSG-32).

describe("validateAvatarFile", () => {
  it("accepts JPEG, PNG and WebP up to 2 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateAvatarFile({ type, size: AVATAR_MAX_BYTES })).toBeNull();
    }
  });

  it("rejects other types and larger files", () => {
    expect(validateAvatarFile({ type: "image/gif", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateAvatarFile({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toMatch(/2 MB/);
  });
});

describe("isOwnAvatarPath", () => {
  it("only allows a single image file in the user's own folder", () => {
    expect(isOwnAvatarPath("u1", "u1/avatar-1.png")).toBe(true);
    expect(isOwnAvatarPath("u1", "u2/avatar.png")).toBe(false);
    expect(isOwnAvatarPath("u1", "u1/sub/avatar.png")).toBe(false);
    expect(isOwnAvatarPath("u1", "u1/../u2/avatar.png")).toBe(false);
    expect(isOwnAvatarPath("u1", "u1/avatar.svg")).toBe(false);
  });
});

describe("prefersDark", () => {
  it("follows the saved theme, and the device only for 'system'", () => {
    expect(prefersDark("dark", false)).toBe(true);
    expect(prefersDark("light", true)).toBe(false);
    expect(prefersDark("system", true)).toBe(true);
    expect(prefersDark("system", false)).toBe(false);
  });
});

describe("web app manifest", () => {
  it("stays installable: standalone, starts at /, has 192/512 and maskable icons", () => {
    const m = manifest();
    expect(m).toMatchObject({ display: "standalone", start_url: "/", scope: "/" });
    const sizes = m.icons?.map((icon) => `${icon.sizes} ${icon.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  });
});
