import { isIP } from "node:net";

export type GuardVerdict =
  | { ok: true }
  | { ok: false; code: "not_http" | "userinfo" | "ssrf" | "invalid_url" };

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal"];

/** Removes the square brackets around an IPv6 literal taken from URL.hostname. */
export function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

export function guardUrl(target: URL): GuardVerdict {
  if (!(target instanceof URL)) {
    return { ok: false, code: "invalid_url" };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: false, code: "not_http" };
  }
  if (target.username !== "" || target.password !== "") {
    return { ok: false, code: "userinfo" };
  }
  const host = stripBrackets(target.hostname.toLowerCase()).replace(/\.$/, "");
  if (host === "") {
    return { ok: false, code: "invalid_url" };
  }
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, code: "ssrf" };
  }
  if (isIP(host) !== 0 && isBlockedAddress(host)) {
    return { ok: false, code: "ssrf" };
  }
  return { ok: true };
}

function ipv4ToInt(address: string): number {
  return address.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

function inV4(value: number, base: string, bits: number): boolean {
  const size = 2 ** (32 - bits);
  const start = ipv4ToInt(base);
  return value >= start && value < start + size;
}

function blockedV4(address: string): boolean {
  const value = ipv4ToInt(address);
  return (
    inV4(value, "0.0.0.0", 8) ||
    inV4(value, "10.0.0.0", 8) ||
    inV4(value, "100.64.0.0", 10) ||
    inV4(value, "127.0.0.0", 8) ||
    inV4(value, "169.254.0.0", 16) ||
    inV4(value, "172.16.0.0", 12) ||
    inV4(value, "192.168.0.0", 16) ||
    value === 0xffffffff
  );
}

/** Expands an IPv6 address (already validated by isIP) to 8 groups of 16 bits. */
function ipv6Groups(address: string): number[] {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = ipv4ToInt(dotted[2]);
    text = `${dotted[1]}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  const parse = (part: string): number[] =>
    part === "" ? [] : part.split(":").map((group) => parseInt(group, 16));
  const index = text.indexOf("::");
  if (index === -1) {
    return parse(text);
  }
  const left = parse(text.slice(0, index));
  const right = parse(text.slice(index + 2));
  return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
}

function blockedV6(address: string): boolean {
  const g = ipv6Groups(address);
  if (g.length !== 8) return true;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(8)) return true; // unspecified
  if (zeros(7) && g[7] === 1) return true; // loopback
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return true; // 64:ff9b::/96
  const embedded = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (zeros(5) && g[5] === 0xffff) return blockedV4(embedded); // ::ffff:a.b.c.d
  if (zeros(6)) return true; // ::a.b.c.d (deprecated IPv4-compatible)
  return false;
}

export function isBlockedAddress(address: string): boolean {
  if (typeof address !== "string") return true;
  const clean = stripBrackets(address.trim());
  const family = isIP(clean);
  if (family === 4) return blockedV4(clean);
  if (family === 6) return blockedV6(clean);
  return true;
}
