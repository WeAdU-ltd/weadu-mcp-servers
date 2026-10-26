import { classifyChannel, ruleOrderNotes, type Ga4Channel } from "./channels.ts";
import { cleanCampaignUrl, fragmentIsUtmQuery } from "./clean-url.ts";
import { GA4_CAVEATS, GA4_SCOPE } from "./ga4-copy.ts";
import { suggestNaming, type NamingSuggestion } from "./normalize.ts";

export const UTM_REQUIRED = ["utm_source", "utm_medium", "utm_campaign"] as const;
export const UTM_OPTIONAL = ["utm_term", "utm_content", "utm_id", "utm_source_platform"] as const;
/** Documented by Google, and documented as not currently reported in GA4 properties. */
export const UTM_UNREPORTED = ["utm_creative_format", "utm_marketing_tactic"] as const;
export type UtmParam = (typeof UTM_REQUIRED)[number] | (typeof UTM_OPTIONAL)[number] | (typeof UTM_UNREPORTED)[number];
export type UtmFindingCode =
  | "invalid_url"
  | "not_http"
  | "userinfo"
  | "missing_required"
  | "empty_value"
  | "whitespace"
  | "duplicate_key"
  | "unknown_utm"
  | "unreported_utm"
  | "value_too_long"
  | "fragment_utm"
  | "mixed_case_value"
  | "malformed_encoding"
  | "ga4_unassigned"
  | "ga4_rule_order"
  | "click_id"
  | "duplicate_url"
  | "variant_url"
  | "equivalent_url";
export interface UtmFinding {
  severity: "error" | "warning";
  code: UtmFindingCode;
  param?: string;
  message: string;
}
export interface Ga4Assessment {
  channel: Ga4Channel | null;
  scope: typeof GA4_SCOPE;
  caveats: readonly string[];
  notes: string[];
}
export interface AuditUtmResult {
  inputUrl: string;
  ok: boolean;
  canonicalUrl: string | null;
  /** Lower case, encoding, duplicate keys, query-like fragments. Synonyms are not applied. */
  cleanedUrl: string | null;
  present: Partial<Record<UtmParam, string>>;
  findings: UtmFinding[];
  ga4: Ga4Assessment;
  /** Optional renames. Not written into cleanedUrl. Each one carries the manual channel before and after. */
  namingSuggestions: NamingSuggestion[];
  weadu: { name: "WeAdU"; url: "https://weadu.com/" };
}

const MAX_VALUE_LENGTH = 200;
const KNOWN: readonly string[] = [...UTM_REQUIRED, ...UTM_OPTIONAL, ...UTM_UNREPORTED];
const UNREPORTED: readonly string[] = [...UTM_UNREPORTED];
const CLICK_IDS = ["gclid", "wbraid", "gbraid", "dclid"] as const;

function isKnown(key: string): key is UtmParam {
  return KNOWN.includes(key);
}

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

interface Pair {
  key: string;
  value: string | null;
  rawValue: string | null;
}

const BROKEN_PERCENT = /%(?![0-9A-Fa-f]{2})/;

function encodingProblem(raw: string): "broken_percent" | "invalid_utf8" | null {
  if (BROKEN_PERCENT.test(raw)) return "broken_percent";
  try {
    decodeURIComponent(raw);
    return null;
  } catch {
    return "invalid_utf8";
  }
}

function splitPairs(raw: string): Pair[] {
  if (raw === "") return [];
  return raw
    .split("&")
    .filter((chunk) => chunk !== "")
    .map((chunk) => {
      const index = chunk.indexOf("=");
      if (index === -1) return { key: safeDecode(chunk), value: null, rawValue: null };
      const rawValue = chunk.slice(index + 1);
      return { key: safeDecode(chunk.slice(0, index)), value: safeDecode(rawValue), rawValue };
    });
}

function emptyGa4(): Ga4Assessment {
  return { channel: null, scope: GA4_SCOPE, caveats: GA4_CAVEATS, notes: [] };
}

function result(
  inputUrl: string,
  canonicalUrl: string | null,
  cleanedUrl: string | null,
  present: Partial<Record<UtmParam, string>>,
  findings: UtmFinding[],
  ga4: Ga4Assessment,
  namingSuggestions: NamingSuggestion[],
): AuditUtmResult {
  return {
    inputUrl,
    ok: !findings.some((finding) => finding.severity === "error"),
    canonicalUrl,
    cleanedUrl,
    present,
    findings,
    ga4,
    namingSuggestions,
    weadu: { name: "WeAdU", url: "https://weadu.com/" },
  };
}

export function auditUtm(input: string): AuditUtmResult {
  const inputUrl = typeof input === "string" ? input : "";
  const invalid = (message: string): AuditUtmResult =>
    result(inputUrl, null, null, {}, [{ severity: "error", code: "invalid_url", message }], emptyGa4(), []);

  if (typeof input !== "string" || input.trim() === "") return invalid("The URL is empty.");

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return invalid("The value is not a valid absolute URL.");
  }

  const findings: UtmFinding[] = [];
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    findings.push({
      severity: "error",
      code: "not_http",
      message: `The URL uses ${url.protocol} instead of http: or https:.`,
    });
  }
  if (url.username !== "" || url.password !== "") {
    findings.push({
      severity: "error",
      code: "userinfo",
      message: "The URL contains a username or password before the host.",
    });
  }
  const canonicalUrl = findings.length === 0 ? url.origin + url.pathname + url.search : null;

  const present: Partial<Record<UtmParam, string>> = {};
  const seen = new Set<string>();
  for (const { key, value, rawValue } of splitPairs(url.search.slice(1))) {
    const lower = key.toLowerCase();
    if (!lower.startsWith("utm_")) continue;
    if (seen.has(lower)) {
      findings.push({
        severity: "error",
        code: "duplicate_key",
        param: lower,
        message: `${lower} appears more than once. This tool keeps the first value in the cleaned URL. Google does not document which copy GA4 keeps; independent tests report the last.`,
      });
      continue;
    }
    seen.add(lower);
    if (!isKnown(lower)) {
      findings.push({
        severity: "warning",
        code: "unknown_utm",
        param: lower,
        message: `${lower} is not a standard UTM parameter and analytics tools may ignore it.`,
      });
    } else if (UNREPORTED.includes(lower)) {
      findings.push({
        severity: "warning",
        code: "unreported_utm",
        param: lower,
        message: `${lower} is a standard UTM parameter. Google says it is not currently reported in Google Analytics properties.`,
      });
    }
    if (value === null || value === "") {
      findings.push({ severity: "error", code: "empty_value", param: lower, message: `${lower} has no value.` });
    } else {
      if (value.trim() !== value) {
        findings.push({
          severity: "error",
          code: "whitespace",
          param: lower,
          message: `${lower} starts or ends with whitespace.`,
        });
      }
      const problem = rawValue !== null ? encodingProblem(rawValue) : null;
      if (problem === "broken_percent") {
        findings.push({
          severity: "warning",
          code: "malformed_encoding",
          param: lower,
          message: `${lower} contains a % that is not followed by two hex digits; the value may be read incorrectly.`,
        });
      } else if (problem === "invalid_utf8") {
        findings.push({
          severity: "warning",
          code: "malformed_encoding",
          param: lower,
          message: `${lower} is percent-encoded but is not valid UTF-8; the value may be read incorrectly.`,
        });
      }
      if (problem === null && value !== value.toLowerCase()) {
        findings.push({
          severity: "warning",
          code: "mixed_case_value",
          param: lower,
          message: `${lower} contains uppercase letters; analytics tools such as GA4 treat "${value}" and "${value.toLowerCase()}" as different values.`,
        });
      }
      if (Array.from(value).length > MAX_VALUE_LENGTH) {
        findings.push({
          severity: "error",
          code: "value_too_long",
          param: lower,
          message: `${lower} is longer than ${MAX_VALUE_LENGTH} characters. This is a limit of this tool, not a limit documented by Google.`,
        });
      }
    }
    if (isKnown(lower)) present[lower] = value ?? "";
  }

  for (const required of UTM_REQUIRED) {
    if (!seen.has(required)) {
      findings.push({
        severity: "error",
        code: "missing_required",
        param: required,
        message: `${required} is missing from the query string.`,
      });
    }
  }

  const hashBody = url.hash.slice(1);
  if (hashBody.toLowerCase().includes("utm_")) {
    if (fragmentIsUtmQuery(hashBody)) {
      const fragmentKeys = splitPairs(hashBody)
        .map((pair) => pair.key)
        .filter((key) => key.toLowerCase().startsWith("utm_"));
      for (const key of new Set(fragmentKeys)) {
        findings.push({
          severity: "warning",
          code: "fragment_utm",
          param: key,
          message: `${key} is in the URL fragment after #, where analytics tools do not read it.`,
        });
      }
    } else {
      findings.push({
        severity: "warning",
        code: "fragment_utm",
        message:
          "The fragment contains UTM tags but is a route, not a query string. They were left in place. Analytics tools do not read UTM tags after #.",
      });
    }
  }

  const clickIds = new Set<string>();
  for (const pair of [...splitPairs(url.search.slice(1)), ...splitPairs(hashBody)]) {
    const name = pair.key.toLowerCase();
    if ((CLICK_IDS as readonly string[]).includes(name)) clickIds.add(name);
  }
  if (clickIds.size > 0) {
    const names = [...clickIds].sort().join(", ");
    findings.push({
      severity: "warning",
      code: "click_id",
      message: `This URL contains ${names}. Those click ids are not read. When Google Ads auto-tagging can be used, GA4 takes the channel from the ad network type and the campaign type, not from the manual channel below.`,
    });
  }

  const medium = present.utm_medium?.trim() ?? "";
  const source = present.utm_source ?? "";
  const campaign = present.utm_campaign ?? "";
  let ga4 = emptyGa4();
  if (canonicalUrl !== null && medium) {
    const channel = classifyChannel(source, medium, campaign);
    const notes = ruleOrderNotes(source, medium, campaign, channel);
    ga4 = { channel, scope: GA4_SCOPE, caveats: GA4_CAVEATS, notes };
    for (const note of notes) {
      findings.push({ severity: "warning", code: "ga4_rule_order", message: note });
    }
    if (channel === "Unassigned") {
      findings.push({
        severity: "warning",
        code: "ga4_unassigned",
        param: "utm_medium",
        message: `Under GA4's manual default-channel rules, utm_medium "${medium}" with this source matches no channel, so the traffic is Unassigned.`,
      });
    }
  }

  const cleaned = canonicalUrl !== null ? cleanCampaignUrl(inputUrl) : null;
  const namingSuggestions = cleaned ? suggestNaming(source, medium, campaign) : [];
  return result(inputUrl, canonicalUrl, cleaned?.url ?? null, present, findings, ga4, namingSuggestions);
}
