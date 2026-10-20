import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { guardUrl, isBlockedAddress, stripBrackets } from "./guard.ts";
import { AI_CRAWLERS, evaluateRobots, type AiCrawler } from "./robots.ts";
import { extractSignals } from "./signals.ts";

export interface CheckDeps {
  fetch: typeof fetch;
  lookup: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}
export interface CrawlerReport {
  agent: AiCrawler;
  allowed: boolean | null;
  matchedRule: string | null;
}
export interface CheckVisibilityResult {
  inputUrl: string;
  ok: boolean;
  error: string | null;
  robots: { fetched: boolean; status: number | null; crawlers: CrawlerReport[] };
  page: {
    fetched: boolean;
    status: number | null;
    finalUrl: string | null;
    contentType: string | null;
    title: string | null;
    hasMetaDescription: boolean;
    metaRobots: string | null;
    canonical: string | null;
    jsonLdTypes: string[];
    noindex: boolean;
  };
  llmsTxt: { status: number | null };
  weadu: { name: "WeAdU"; url: "https://weadu.com/" };
}

export const USER_AGENT = "WeAdU-AI-Visibility/1.0.0 (+https://weadu.com/)";
const ACCEPT = "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8";
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const LIMIT_ROBOTS = 256 * 1024;
const LIMIT_PAGE = 1024 * 1024;
const LIMIT_LLMS = 1024;

const defaultDeps: CheckDeps = {
  fetch: (input, init) => globalThis.fetch(input, init),
  lookup: (hostname) => dns.lookup(hostname, { all: true, verbatim: true }),
};

type FetchErrorCode = "ssrf" | "dns_failed" | "too_many_redirects" | "response_too_large" | "network" | "invalid_url" | "not_http" | "userinfo";

type FetchOutcome =
  | { kind: "ok"; status: number; finalUrl: URL; headers: Headers; body: string }
  | { kind: "error"; code: FetchErrorCode };

class TooLarge extends Error {}

async function readLimited(response: Response, limit: number, truncate: boolean): Promise<string> {
  if (response.body === null) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      if (truncate) break;
      throw new TooLarge();
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

async function checkHost(target: URL, deps: CheckDeps): Promise<FetchErrorCode | null> {
  const host = stripBrackets(target.hostname);
  if (isIP(host) !== 0) {
    return isBlockedAddress(host) ? "ssrf" : null;
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await deps.lookup(host);
  } catch {
    return "dns_failed";
  }
  if (addresses.length === 0) return "dns_failed";
  return addresses.some((entry) => isBlockedAddress(entry.address)) ? "ssrf" : null;
}

/**
 * GET with manual redirects (guard and DNS check on every hop) and a size cap.
 * With `truncate`, a body over the cap is cut instead of failing: used for llms.txt, where only the status counts.
 */
async function safeFetch(start: URL, limit: number, deps: CheckDeps, truncate = false): Promise<FetchOutcome> {
  let current = start;
  for (let hop = 0; ; hop += 1) {
    const verdict = guardUrl(current);
    if (!verdict.ok) return { kind: "error", code: verdict.code };
    const hostError = await checkHost(current, deps);
    if (hostError !== null) return { kind: "error", code: hostError };
    let response: Response;
    try {
      response = await deps.fetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: ACCEPT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return { kind: "error", code: "network" };
    }
    const location = response.headers.get("location");
    if (REDIRECT_STATUSES.has(response.status) && location !== null) {
      await response.body?.cancel().catch(() => undefined);
      if (hop >= MAX_REDIRECTS) return { kind: "error", code: "too_many_redirects" };
      try {
        current = new URL(location, current);
      } catch {
        return { kind: "error", code: "invalid_url" };
      }
      continue;
    }
    try {
      const body = await readLimited(response, limit, truncate);
      return { kind: "ok", status: response.status, finalUrl: current, headers: response.headers, body };
    } catch (error) {
      return { kind: "error", code: error instanceof TooLarge ? "response_too_large" : "network" };
    }
  }
}

function emptyResult(inputUrl: string): CheckVisibilityResult {
  return {
    inputUrl,
    ok: false,
    error: null,
    robots: {
      fetched: false,
      status: null,
      crawlers: AI_CRAWLERS.map((agent) => ({ agent, allowed: null, matchedRule: null })),
    },
    page: {
      fetched: false,
      status: null,
      finalUrl: null,
      contentType: null,
      title: null,
      hasMetaDescription: false,
      metaRobots: null,
      canonical: null,
      jsonLdTypes: [],
      noindex: false,
    },
    llmsTxt: { status: null },
    weadu: { name: "WeAdU", url: "https://weadu.com/" },
  };
}

export async function checkAiVisibility(input: string, deps: CheckDeps = defaultDeps): Promise<CheckVisibilityResult> {
  const inputUrl = typeof input === "string" ? input : "";
  const result = emptyResult(inputUrl);
  const setError = (code: string) => {
    if (result.error === null) result.error = code;
  };

  let target: URL;
  try {
    target = new URL(inputUrl.trim());
  } catch {
    result.error = "invalid_url";
    return result;
  }
  const verdict = guardUrl(target);
  if (!verdict.ok) {
    result.error = verdict.code;
    return result;
  }

  // 1. robots.txt at the origin, rules evaluated against the requested path.
  const robots = await safeFetch(new URL("/robots.txt", target.origin), LIMIT_ROBOTS, deps);
  if (robots.kind === "ok" && (robots.status === 404 || robots.status === 410)) {
    result.robots = {
      fetched: true,
      status: robots.status,
      crawlers: AI_CRAWLERS.map((agent) => ({ agent, allowed: true, matchedRule: null })),
    };
  } else if (robots.kind === "ok" && robots.status >= 200 && robots.status < 300) {
    const path = target.pathname + target.search;
    result.robots = {
      fetched: true,
      status: robots.status,
      crawlers: AI_CRAWLERS.map((agent) => ({ agent, ...evaluateRobots(robots.body, agent, path) })),
    };
  } else {
    result.robots.status = robots.kind === "ok" ? robots.status : null;
    const code = robots.kind === "error" ? robots.code : "network";
    setError(code === "ssrf" || code === "dns_failed" || code === "response_too_large" ? code : "robots_unreachable");
  }

  // 2. The page itself.
  const page = await safeFetch(target, LIMIT_PAGE, deps);
  if (page.kind === "ok") {
    const contentType = page.headers.get("content-type");
    const xRobots = page.headers.get("x-robots-tag");
    const isMarkup = /html|xml/i.test(contentType ?? "");
    const signals =
      page.status >= 200 && page.status < 300 && isMarkup
        ? extractSignals(page.body, xRobots)
        : { ...extractSignals("", xRobots) };
    result.page = {
      fetched: true,
      status: page.status,
      finalUrl: page.finalUrl.href,
      contentType,
      ...signals,
    };
  } else {
    setError(page.code === "network" ? "page_unreachable" : page.code);
  }

  // 3. llms.txt: status only, never overrides an error.
  const llmsBase = page.kind === "ok" ? page.finalUrl : target;
  const llms = await safeFetch(new URL("/llms.txt", llmsBase.origin), LIMIT_LLMS, deps, true);
  result.llmsTxt.status = llms.kind === "ok" ? llms.status : null;

  const allowed = (agent: AiCrawler) => result.robots.crawlers.find((c) => c.agent === agent)?.allowed === true;
  result.ok =
    result.error === null &&
    result.page.status === 200 &&
    result.page.noindex === false &&
    allowed("GPTBot") &&
    allowed("Google-Extended");
  return result;
}
