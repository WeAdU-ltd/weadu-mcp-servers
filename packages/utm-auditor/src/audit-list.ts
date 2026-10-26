import { auditUtm, type UtmFinding } from "./audit-utm.ts";
import { cleanCampaignUrl } from "./clean-url.ts";
import { type Ga4Channel } from "./channels.ts";
import { GA4_CAVEATS } from "./ga4-copy.ts";
import { normalizeParam, type NamingSuggestion } from "./normalize.ts";
import type { Ga4Assessment } from "./audit-utm.ts";

export const MAX_URLS = 5000;

export interface ListItem {
  index: number;
  inputUrl: string;
  ok: boolean;
  findings: UtmFinding[];
  ga4: Ga4Assessment;
  cleanedUrl: string | null;
  namingSuggestions: NamingSuggestion[];
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
  ga4Caveats: readonly string[];
  synonyms: SynonymGroup[];
  items: ListItem[];
  truncated: boolean;
  weadu: { name: "WeAdU"; url: "https://weadu.com/" };
}

function utmSignature(raw: Map<string, string>): string {
  return [...raw.entries()]
    .filter(([key]) => key.startsWith("utm_"))
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("&");
}

export function auditUtmList(urls: readonly string[]): AuditListResult {
  const list = Array.isArray(urls) ? urls : [];
  const truncated = list.length > MAX_URLS;
  const items: ListItem[] = [];
  const firstByKey = new Map<string, { index: number; signature: string }>();
  const variants = new Map<string, Map<string, number>>();
  const channels: Partial<Record<Ga4Channel, number>> = {};

  list.slice(0, MAX_URLS).forEach((input, index) => {
    const text = typeof input === "string" ? input : "";
    const audit = auditUtm(text);
    const findings = [...audit.findings];
    const cleaned = audit.canonicalUrl === null ? null : cleanCampaignUrl(text);
    let duplicateOf: number | null = null;

    if (cleaned) {
      for (const [param, value] of cleaned.raw) {
        if (param !== "utm_source" && param !== "utm_medium" && param !== "utm_campaign") continue;
        const groupKey = `${param}\u0000${normalizeParam(param, value)}`;
        const counts = variants.get(groupKey) ?? new Map<string, number>();
        counts.set(value.trim(), (counts.get(value.trim()) ?? 0) + 1);
        variants.set(groupKey, counts);
      }
      if (audit.ga4.channel) channels[audit.ga4.channel] = (channels[audit.ga4.channel] ?? 0) + 1;
      const signature = utmSignature(cleaned.raw);
      const first = firstByKey.get(cleaned.key);
      if (first === undefined) firstByKey.set(cleaned.key, { index, signature });
      else {
        duplicateOf = first.index;
        const exact = (list[first.index] ?? "").trim() === text.trim();
        if (exact) {
          findings.push({ severity: "warning", code: "duplicate_url", message: `Same URL as item ${first.index}.` });
        } else if (signature === first.signature) {
          findings.push({
            severity: "warning",
            code: "equivalent_url",
            message: `Same UTM values as item ${first.index}. Parameter order, the fragment, and host or path case do not change the values GA4 reads, and GA4 does not read UTM tags after #.`,
          });
        } else {
          findings.push({
            severity: "warning",
            code: "variant_url",
            message: `Same campaign as item ${first.index} once letter case is folded. GA4 counts those values as separate rows.`,
          });
        }
      }
    }

    items.push({
      index,
      inputUrl: text,
      ok: !findings.some((finding) => finding.severity === "error"),
      findings,
      ga4: audit.ga4,
      cleanedUrl: audit.cleanedUrl,
      namingSuggestions: audit.namingSuggestions,
      changed: audit.cleanedUrl !== null && audit.cleanedUrl !== text.trim(),
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
      ok: items.filter((item) => item.ok).length,
      withErrors: items.filter((item) => !item.ok).length,
      withWarnings: items.filter((item) => item.findings.some((finding) => finding.severity === "warning")).length,
      duplicates: items.filter((item) => item.duplicateOf !== null).length,
      unassignedChannel: channels.Unassigned ?? 0,
      changed: items.filter((item) => item.changed).length,
      channels,
    },
    ga4Caveats: GA4_CAVEATS,
    synonyms,
    items,
    truncated,
    weadu: { name: "WeAdU", url: "https://weadu.com/" },
  };
}
