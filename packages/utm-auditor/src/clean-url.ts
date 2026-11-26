import { repairDecode } from "./normalize.ts";

/** Letter case is meaningful for ids and for the platform parameters, so the cleaned URL keeps it. */
const KEEP_CASE = new Set(["utm_id", "utm_source_platform", "utm_creative_format", "utm_marketing_tactic"]);

/**
 * True when the fragment is only a query string that contains a UTM key.
 * A route such as "#/dashboard?utm_source=google" is not a query string.
 */
export function fragmentIsUtmQuery(hashBody: string): boolean {
  if (hashBody === "" || hashBody.includes("/") || hashBody.includes("?") || hashBody.includes("#")) return false;
  const chunks = hashBody.split("&").filter((chunk) => chunk !== "");
  if (chunks.length === 0) return false;
  let utm = false;
  for (const chunk of chunks) {
    const eq = chunk.indexOf("=");
    const rawKey = eq === -1 ? chunk : chunk.slice(0, eq);
    if (rawKey === "" || /[/?#\s]/.test(rawKey)) return false;
    const key = repairDecode(rawKey).trim().toLowerCase().replace(/^\?+/, "");
    if (key.startsWith("utm_")) utm = true;
  }
  return utm;
}

export interface CleanedCampaign {
  url: string;
  /** First decoded value of each utm_* key, trimmed, original letter case. */
  raw: Map<string, string>;
  /** Identity used to compare URLs: UTM values folded, parameter order ignored, fragment ignored. */
  key: string;
}

/** Mechanical cleanup only. Synonyms are not applied. Returns null when the URL cannot be cleaned. */
export function cleanCampaignUrl(input: string): CleanedCampaign | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;

  const entries: { key: string | null; text: string }[] = [];
  const raw = new Map<string, string>();
  const mechanical = new Map<string, string>();

  const take = (query: string, inQuery: boolean): string[] => {
    const rest: string[] = [];
    for (const chunk of query.split("&")) {
      if (chunk === "") continue;
      const eq = chunk.indexOf("=");
      const rawKey = eq === -1 ? chunk : chunk.slice(0, eq);
      const key = repairDecode(rawKey).trim().toLowerCase().replace(/^\?+/, "");
      if (!key.startsWith("utm_")) {
        if (inQuery) entries.push({ key: null, text: chunk });
        else rest.push(chunk);
        continue;
      }
      if (raw.has(key)) continue;
      const decoded = eq === -1 ? "" : repairDecode(chunk.slice(eq + 1));
      if (decoded.trim() === "") continue;
      const trimmed = decoded.trim();
      raw.set(key, trimmed);
      mechanical.set(key, KEEP_CASE.has(key) ? trimmed : trimmed.toLowerCase());
      entries.push({ key, text: "" });
    }
    return rest;
  };

  take(url.search.slice(1), true);
  const hash = url.hash.slice(1);
  const hashRest = fragmentIsUtmQuery(hash) ? take(hash, false) : null;
  const parts = entries.map((entry) =>
    entry.key === null ? entry.text : `${entry.key}=${encodeURIComponent(mechanical.get(entry.key) ?? "")}`,
  );
  const query = parts.join("&");
  const fragment = hashRest === null ? (hash ? `#${hash}` : "") : hashRest.length ? `#${hashRest.join("&")}` : "";
  const base = url.origin + url.pathname;
  const utmKey = [...raw.entries()].map(([key, value]) => `${key}=${value.toLowerCase()}`).sort();
  const otherKey = entries.filter((entry) => entry.key === null).map((entry) => entry.text).sort();
  const key = base.toLowerCase().replace(/\/$/, "") + "?" + [...utmKey, ...otherKey].sort().join("&");
  return { url: base + (query ? `?${query}` : "") + fragment, raw, key };
}
