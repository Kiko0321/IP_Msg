import { isIP } from "node:net";

// MSG-24: the "IP" this app knows about is the client's public address as seen by the server.
// See docs/network-information.md for its meaning, visibility and limitations.

export type ConnectionInfo = {
  /** Public IP the request came from, or null when it can't be determined. */
  ip: string | null;
  version: 4 | 6 | null;
  /** True for loopback/private ranges, e.g. when running the app locally. */
  isPrivate: boolean;
};

const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

function isPrivateAddress(ip: string, version: 4 | 6) {
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

// The first x-forwarded-for entry is the original client. Hosting proxies set it; without a proxy
// Next.js fills it from the socket. A client can send a fake value, which is why this is only ever
// shown to that same user and never trusted for anything else.
export function connectionInfo(headers: Headers): ConnectionInfo {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  let ip = forwarded || headers.get("x-real-ip")?.trim() || null;
  if (ip) ip = ip.replace(IPV4_MAPPED, "$1");

  const kind = ip ? isIP(ip) : 0;
  if (!ip || kind === 0) return { ip: null, version: null, isPrivate: false };

  const version = kind as 4 | 6;
  return { ip, version, isPrivate: isPrivateAddress(ip, version) };
}
