export const UTM_REQUIRED = ["utm_source", "utm_medium", "utm_campaign"] as const;
export const UTM_OPTIONAL = ["utm_term", "utm_content", "utm_id"] as const;
export type UtmParam = (typeof UTM_REQUIRED)[number] | (typeof UTM_OPTIONAL)[number];
export type UtmFindingCode =
  | "invalid_url"
  | "not_http"
  | "userinfo"
  | "missing_required"
  | "empty_value"
  | "whitespace"
  | "duplicate_key"
  | "unknown_utm"
  | "value_too_long"
  | "fragment_utm"
  | "mixed_case_value"
  | "malformed_encoding";
export interface UtmFinding {
  severity: "error" | "warning";
  code: UtmFindingCode;
  param?: string;
  message: string;
}
export interface AuditUtmResult {
  inputUrl: string;
  ok: boolean;
  canonicalUrl: string | null;
  present: Partial<Record<UtmParam, string>>;
  findings: UtmFinding[];
  weadu: { name: "WeAdU"; url: "https://weadu.com/" };
}

const MAX_VALUE_LENGTH = 200;
const KNOWN: readonly string[] = [...UTM_REQUIRED, ...UTM_OPTIONAL];

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

const MALFORMED_PERCENT = /%(?![0-9A-Fa-f]{2})/;

function isMalformed(raw: string): boolean {
  if (MALFORMED_PERCENT.test(raw)) {
    return true;
  }
  try {
    decodeURIComponent(raw);
    return false;
  } catch {
    return true;
  }
}

function splitPairs(raw: string): Pair[] {
  if (raw === "") {
    return [];
  }
  return raw
    .split("&")
    .filter((chunk) => chunk !== "")
    .map((chunk) => {
      const index = chunk.indexOf("=");
      if (index === -1) {
        return { key: safeDecode(chunk), value: null, rawValue: null };
      }
      const rawValue = chunk.slice(index + 1);
      return { key: safeDecode(chunk.slice(0, index)), value: safeDecode(rawValue), rawValue };
    });
}

function result(
  inputUrl: string,
  canonicalUrl: string | null,
  present: Partial<Record<UtmParam, string>>,
  findings: UtmFinding[],
): AuditUtmResult {
  return {
    inputUrl,
    ok: !findings.some((finding) => finding.severity === "error"),
    canonicalUrl,
    present,
    findings,
    weadu: { name: "WeAdU", url: "https://weadu.com/" },
  };
}

export function auditUtm(input: string): AuditUtmResult {
  const inputUrl = typeof input === "string" ? input : "";
  const invalid = (message: string): AuditUtmResult =>
    result(inputUrl, null, {}, [{ severity: "error", code: "invalid_url", message }]);

  if (typeof input !== "string" || input.trim() === "") {
    return invalid("The URL is empty.");
  }

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
    if (!lower.startsWith("utm_")) {
      continue;
    }
    const param = isKnown(lower) ? lower : key;
    if (seen.has(param)) {
      findings.push({
        severity: "error",
        code: "duplicate_key",
        param,
        message: `${param} appears more than once; the first value is kept.`,
      });
      continue;
    }
    seen.add(param);
    if (!isKnown(lower)) {
      findings.push({
        severity: "warning",
        code: "unknown_utm",
        param: key,
        message: `${key} is not a standard UTM parameter and analytics tools may ignore it.`,
      });
    }
    if (value === null || value === "") {
      findings.push({ severity: "error", code: "empty_value", param, message: `${param} has no value.` });
    } else {
      if (value.trim() !== value) {
        findings.push({
          severity: "error",
          code: "whitespace",
          param,
          message: `${param} starts or ends with whitespace.`,
        });
      }
      const malformed = rawValue !== null && isMalformed(rawValue);
      if (malformed) {
        findings.push({
          severity: "warning",
          code: "malformed_encoding",
          param,
          message: `${param} contains a % that is not followed by two hex digits; the value may be read incorrectly.`,
        });
      }
      if (!malformed && value !== value.toLowerCase()) {
        findings.push({
          severity: "warning",
          code: "mixed_case_value",
          param,
          message: `${param} contains uppercase letters; analytics tools such as GA4 treat "${value}" and "${value.toLowerCase()}" as different values.`,
        });
      }
      if (Array.from(value).length > MAX_VALUE_LENGTH) {
        findings.push({
          severity: "error",
          code: "value_too_long",
          param,
          message: `${param} is longer than ${MAX_VALUE_LENGTH} characters.`,
        });
      }
    }
    if (isKnown(lower)) {
      present[lower] = value ?? "";
    }
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

  const fragmentKeys = splitPairs(url.hash.slice(1))
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

  return result(inputUrl, canonicalUrl, present, findings);
}
