export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "Googlebot",
  "PerplexityBot",
  "ClaudeBot",
  "anthropic-ai",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
] as const;
export type AiCrawler = (typeof AI_CRAWLERS)[number];
export interface RobotsDecision {
  allowed: boolean;
  matchedRule: string | null;
}

interface Rule {
  kind: "allow" | "disallow";
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

function parseGroups(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of body.split(/\r\n|\r|\n/)) {
    const hash = rawLine.indexOf(" #");
    const line = (hash === -1 ? rawLine : rawLine.slice(0, hash)).trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) {
      continue;
    }
    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (directive === "user-agent") {
      if (current === null || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
      lastWasAgent = true;
    } else if (directive === "allow" || directive === "disallow") {
      if (current !== null) {
        current.rules.push({ kind: directive, pattern: value });
      }
      lastWasAgent = false;
    }
  }
  return groups;
}

function toRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`);
}

export function evaluateRobots(body: string, crawler: string, pathWithQuery: string): RobotsDecision {
  const name = crawler.toLowerCase();
  let bestLength = -1;
  let rules: Rule[] = [];
  for (const group of parseGroups(body)) {
    for (const agent of group.agents) {
      const lower = agent.toLowerCase();
      if (lower !== "*" && (lower === "" || !name.startsWith(lower))) {
        continue;
      }
      if (lower.length > bestLength) {
        bestLength = lower.length;
        rules = [...group.rules];
      } else if (lower.length === bestLength) {
        // Same user-agent in several groups: merge their rules, as Google does.
        rules.push(...group.rules);
      }
    }
  }
  if (bestLength === -1) {
    return { allowed: true, matchedRule: null };
  }
  let winner: Rule | null = null;
  for (const rule of rules) {
    if (rule.pattern !== "" && !toRegExp(rule.pattern).test(pathWithQuery)) {
      continue;
    }
    const length = rule.pattern.length;
    const winnerLength = winner === null ? -1 : winner.pattern.length;
    if (
      winner === null ||
      length > winnerLength ||
      (length === winnerLength && rule.kind === "allow" && winner.kind === "disallow")
    ) {
      winner = rule;
    }
  }
  if (winner === null) {
    return { allowed: true, matchedRule: null };
  }
  const allowed = winner.pattern === "" ? true : winner.kind === "allow";
  return { allowed, matchedRule: `${winner.kind}:${winner.pattern}` };
}
