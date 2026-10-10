# Network information ("IP")

The original IP Messenger was a LAN tool: it found other users on the local network and showed each one's host name and IP address. This app runs in the browser over the internet, so "IP" needs a definition. This document records it (MSG-24).

## What "IP" means here

| Field | Meaning | Available? |
| --- | --- | --- |
| **Public IP** | The address the server sees a request coming from: the first entry of `x-forwarded-for`, which hosting proxies set and Next.js fills from the socket when there is no proxy. IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is shown as IPv4. | Yes, for the current request |
| **IP version** | `IPv4` or `IPv6` of that address | Yes |
| **LAN IP** | The device's address on its local network | **No.** Browsers don't expose it (WebRTC hides local addresses behind mDNS names), and the server never sees it |
| **Host name** | The device's name | **No.** Not available to web apps |

Code: [lib/network.ts](../lib/network.ts) (`connectionInfo`), shown on [`/network`](../app/network/page.tsx).

## Who can see it

- **Only the user themselves,** on `/network` (linked from the profile page) while signed in.
- **Never other users.** Contacts, chats and profiles show no IP information. An IP address is personal data: it reveals approximate location and can identify a household.
- **Never stored.** It is worked out on each request and not written to the database.
- **Never logged by the app.** The error logger records method and path only ([observability.md](observability.md)). Your hosting platform's own access logs are separate and follow its retention rules.

## Limitations

- **It's the network's address, not the device's.** Behind a VPN, proxy, corporate gateway or mobile carrier it is that service's address. Carrier-grade NAT means many users can share one public IP.
- **It changes** when the user reconnects, switches networks, or gets a new lease from their ISP.
- **It can be faked.** A client can send its own `x-forwarded-for` header when no trusted proxy overwrites it. That only fools the user looking at their own page, which is why the value is never used for access control, rate limiting or auditing.
- **Local development** shows a loopback or private address (`::1`, `127.0.0.1`, `192.168.x.x`), and the page labels it as such.
- **IPv4 vs IPv6** depends on the user's network and the host. The same user can show either.

## What it isn't used for

There is no LAN discovery, no IP-based lookup of other users, and no geolocation. Users are found through the contact directory (MSG-14), and online status comes from presence (MSG-23).
