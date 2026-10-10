// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { logger, redact } from "./logger";
import { connectionInfo } from "./network";

describe("redact (MSG-29)", () => {
  it("hides secret keys at any depth", () => {
    expect(redact({ password: "p", nested: { apiKey: "k", Authorization: "Bearer x", ok: "fine" } })).toEqual({
      password: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", Authorization: "[REDACTED]", ok: "fine" },
    });
  });

  it("hides secret-looking values under any key and inside errors", () => {
    const out = redact({
      note: "key sb_secret_ABC123 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig",
      url: "postgresql://postgres:s3cr3t@db.example.com:5432/postgres",
      error: new Error("failed with sb_publishable_XYZ"),
    }) as Record<string, unknown>;

    expect(out.note).toBe("key [REDACTED] jwt [REDACTED]");
    expect(out.url).toBe("postgresql://postgres:[REDACTED]@db.example.com:5432/postgres");
    expect((out.error as { message: string }).message).toBe("failed with [REDACTED]");
  });

  it("writes one JSON line per entry, errors to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", { cookie: "a=b", userId: "u1" });

    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({ level: "error", msg: "boom", cookie: "[REDACTED]", userId: "u1" });
    expect(typeof entry.time).toBe("string");
  });
});

describe("connectionInfo (MSG-24)", () => {
  const info = (headers: Record<string, string>) => connectionInfo(new Headers(headers));

  it("uses the first x-forwarded-for hop", () => {
    expect(info({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toEqual({ ip: "203.0.113.7", version: 4, isPrivate: false });
  });

  it("unwraps IPv4-mapped IPv6 and detects IPv6", () => {
    expect(info({ "x-forwarded-for": "::ffff:198.51.100.2" }).ip).toBe("198.51.100.2");
    expect(info({ "x-forwarded-for": "2001:db8::1" }).version).toBe(6);
  });

  it("flags loopback and private addresses", () => {
    expect(info({ "x-forwarded-for": "::1" }).isPrivate).toBe(true);
    expect(info({ "x-forwarded-for": "192.168.1.20" }).isPrivate).toBe(true);
    expect(info({ "x-forwarded-for": "172.20.0.5" }).isPrivate).toBe(true);
  });

  it("returns null for missing or invalid values", () => {
    expect(info({}).ip).toBeNull();
    expect(info({ "x-forwarded-for": "not-an-ip" }).ip).toBeNull();
  });
});
