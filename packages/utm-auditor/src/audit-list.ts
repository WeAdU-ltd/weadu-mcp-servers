import { auditUtm, type UtmFinding } from "./audit-utm.ts";
import { classifyChannel, mediumHasChannel, type Ga4Channel } from "./channels.ts";
import { normalizeParam, repairDecode } from "./normalize.ts";

export const MAX_URLS = 5000;

export interface ListItem {
  index: number;
  inputUrl: string;
  ok: boolean;
  findings: UtmFinding[];
  ga4Channel: Ga4Channel | null;
  suggestedUrl: string | null;
  changed: boolean;
  duplicateOf: number | null;
}

export interface SynonymGroup {
  param: string;
  normalized: string;
  variants: { value: string; count: number }[];
}

export interface AuditListResult {
  summary: {
    total: number;
    ok: number;
    withErrors: number;
    withWarnings: number;
    duplicates: number;
    unassignedChannel: number;
    changed: number;
    channels: Partial<Record<Ga4Channel, number>>;
  };
  synonyms: SynonymGroup[];
  items: ListItem[];
  truncated: boolean;
  weadu: { name: "WeAdU"; url: "https://weadu.com/" };
}

interface Built {
  url: string;
  key: string;
  utm: Map<string, string>;
  raw: Map<string, string>;
}

function rebuild(input: string): Built | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
  // Entries keep their original order; UTM values are replaced in place.
  const entries: { key: string | null; text: string }[] = [];
  const utm = new Map<string, string>();
  const raw = new Map<string, string>();
  const take = (query: string, inQuery: boolean): string[] => {
    const rest: string[] = [];
    for (const chunk of query.split("&")) {
      if (chunk === "") continue;
      const eq = chunk.indexOf("=");
      const rawKey = eq === -1 ? chunk : chunk.slice(0, eq);
      // "??utm_source=" leaves a stray "?" in the key: drop it.
      const key = repairDecode(rawKey).trim().toLowerCase().replace(/^\?+/, "");
      if (!key.startsWith("utm_")) {
        if (inQuery) entries.push({ key: null, text: chunk });
        else rest.push(chunk);
        continue;
      }
      if (utm.has(key)) continue; // keep the first value, like auditUtm
      const value = eq === -1 ? "" : repairDecode(chunk.slice(eq + 1));
      if (value.trim() === "") continue;
      raw.set(key, value);
      utm.set(key, normalizeParam(key, value));
      entries.push({ key, text: "" });
    }
    return rest;
  };
  take(url.search.slice(1), true);
  const hash = url.hash.slice(1);
  // UTM tags found after # are moved into the query, where analytics tools read them.
  const hashRest = hash.includes("=") ? take(hash, false) : null;
  const parts = entries.map((e) => (e.key === null ? e.text : `${e.key}=${encodeURIComponent(utm.get(e.key) ?? "")}`));
  const query = parts.join("&");
  const fragment = hashRest === null ? (hash ? `#${hash}` : "") : hashRest.length ? `#${hashRest.join("&")}` : "";
  const base = url.origin + url.pathname;
  const key = base.toLowerCase().replace(/\/$/, "") + "?" + [...parts].sort().join("&");
  return { url: base + (query ? `?${query}` : "") + fragment, key, utm, raw };
}

export function auditUtmList(urls: readonly string[]): AuditListResult {
  const list = Array.isArray(urls) ? urls : [];
  const truncated = list.length > MAX_URLS;
  const items: ListItem[] = [];
  const firstByKey = new Map<string, number>();
  const variants = new Map<string, Map<string, number>>();
  const channels: Partial<Record<Ga4Channel, number>> = {};

  list.slice(0, MAX_URLS).forEach((input, index) => {
    const text = typeof input === "string" ? input : "";
    const audit = auditUtm(text);
    const findings = [...audit.findings];
    const built = audit.canonicalUrl === null ? null : rebuild(text);
    let ga4Channel: Ga4Channel | null = null;
    let duplicateOf: number | null = null;

    if (built) {
      for (const [param, value] of built.raw) {
        if (param !== "utm_source" && param !== "utm_medium" && param !== "utm_campaign") continue;
        const groupKey = `${param}\u0000${built.utm.get(param)}`;
        const counts = variants.get(groupKey) ?? new Map<string, number>();
        counts.set(value.trim(), (counts.get(value.trim()) ?? 0) + 1);
        variants.set(groupKey, counts);
      }
      const medium = audit.present.utm_medium?.trim();
      if (medium) {
        ga4Channel = classifyChannel(audit.present.utm_source ?? "", medium, audit.present.utm_campaign ?? "");
        if (ga4Channel === "Unassigned") {
          const fixed = built.utm.get("utm_medium") ?? "";
          const hint = fixed !== medium.toLowerCase() && mediumHasChannel(fixed) ? ` Use "${fixed}" instead.` : "";
          findings.push({
            severity: "warning",
            code: "ga4_unassigned",
            param: "utm_medium",
            message: `GA4 puts utm_medium "${medium}" with this source in no default channel, so the traffic shows as Unassigned.${hint}`,
          });
        }
        channels[ga4Channel] = (channels[ga4Channel] ?? 0) + 1;
      }
      const first = firstByKey.get(built.key);
      if (first === undefined) firstByKey.set(built.key, index);
      else {
        duplicateOf = first;
        const exact = (list[first] ?? "").trim() === text.trim();
        findings.push({
          severity: "warning",
          code: exact ? "duplicate_url" : "variant_url",
          message: exact
            ? `Same URL as item ${first}.`
            : `Same campaign as item ${first} once case and synonyms are normalized; GA4 would split it into separate rows.`,
        });
      }
    }

    items.push({
      index,
      inputUrl: text,
      ok: !findings.some((f) => f.severity === "error"),
      findings,
      ga4Channel,
      suggestedUrl: built?.url ?? null,
      changed: built !== null && built.url !== text.trim(),
      duplicateOf,
    });
  });

  const synonyms: SynonymGroup[] = [];
  for (const [groupKey, counts] of variants) {
    if (counts.size < 2) continue;
    const [param, normalized] = groupKey.split("\u0000") as [string, string];
    synonyms.push({
      param,
      normalized,
      variants: [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    });
  }

  return {
    summary: {
      total: items.length,
      ok: items.filter((i) => i.ok).length,
      withErrors: items.filter((i) => !i.ok).length,
      withWarnings: items.filter((i) => i.findings.some((f) => f.severity === "warning")).length,
      duplicates: items.filter((i) => i.duplicateOf !== null).length,
      unassignedChannel: channels.Unassigned ?? 0,
      changed: items.filter((i) => i.changed).length,
      channels,
    },
    synonyms,
    items,
    truncated,
    weadu: { name: "WeAdU", url: "https://weadu.com/" },
  };
}
