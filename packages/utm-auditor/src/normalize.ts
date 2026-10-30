import { classifyChannel, type Ga4Channel } from "./channels.ts";

// Optional naming suggestions. They are reported beside the cleaned URL and are
// not written into it. Rewrites that change the meaning or the channel without
// a real synonym are absent: text/txt, seo, newsletter, paid/sem/adwords,
// fb, insta, li, pin, x, x.com.
const SOURCE_SYNONYMS: Record<string, string[]> = {
  linkedin: ["linkedin", "lnkd", "lnkd.in", "linked_in", "linked-in", "linkedin.com", "www.linkedin.com"],
  facebook: ["facebook", "fbook", "facebook.com", "www.facebook.com", "m.facebook.com", "l.facebook.com"],
  instagram: ["instagram", "ig", "instagram.com", "www.instagram.com", "l.instagram.com"],
  twitter: ["twitter", "tw", "twitter.com", "t.co"],
  youtube: ["youtube", "yt", "youtube.com", "www.youtube.com", "youtu.be"],
  google: ["google", "google.com", "www.google.com", "googleads", "google_ads", "google-ads"],
  bing: ["bing", "bing.com", "microsoft_ads", "microsoft-ads", "msads"],
  tiktok: ["tiktok", "tik_tok", "tik-tok", "tiktok.com"],
  pinterest: ["pinterest", "pinterest.com"],
  reddit: ["reddit", "reddit.com"],
  email: ["email", "e-mail", "e_mail", "e mail", "mail"],
  newsletter: ["newsletter", "news_letter", "news-letter", "nl"],
};

const MEDIUM_SYNONYMS: Record<string, string[]> = {
  cpc: ["cpc", "ppc", "paidsearch", "paid_search", "paid-search"],
  "paid-social": ["paid-social", "paid_social", "paidsocial", "social_paid", "social-paid"],
  social: ["social", "social-media", "social_media", "socialmedia", "social media", "social-network", "social_network", "social network", "sm", "organic_social", "organic-social"],
  email: ["email", "e-mail", "e_mail", "e mail", "mail", "emailing"],
  affiliate: ["affiliate", "affiliates", "aff", "affiliation"],
  referral: ["referral", "ref", "referer", "referrer"],
  display: ["display", "banner", "banners"],
  organic: ["organic"],
  sms: ["sms"],
};

function invert(table: Record<string, string[]>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(table)) {
    for (const variant of variants) map.set(variant, canonical);
  }
  return map;
}

const SOURCE_MAP = invert(SOURCE_SYNONYMS);
const MEDIUM_MAP = invert(MEDIUM_SYNONYMS);

export function cleanValue(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeSource(value: string): string {
  const clean = cleanValue(value);
  return SOURCE_MAP.get(clean) ?? clean;
}

export function normalizeMedium(value: string): string {
  const clean = cleanValue(value);
  return MEDIUM_MAP.get(clean) ?? clean;
}

export function normalizeParam(param: string, value: string): string {
  if (param === "utm_source") return normalizeSource(value);
  if (param === "utm_medium") return normalizeMedium(value);
  return cleanValue(value);
}

export interface NamingSuggestion {
  param: "utm_source" | "utm_medium";
  from: string;
  to: string;
  channelBefore: Ga4Channel | null;
  channelAfter: Ga4Channel | null;
}

/** One suggestion per parameter. The channel after swaps only that parameter. */
export function suggestNaming(source: string, medium: string, campaign: string): NamingSuggestion[] {
  const before = medium.trim() ? classifyChannel(source, medium, campaign) : null;
  const suggestions: NamingSuggestion[] = [];
  const consider = (param: "utm_source" | "utm_medium", value: string): void => {
    const from = value.trim();
    if (from === "") return;
    const to = param === "utm_source" ? normalizeSource(from) : normalizeMedium(from);
    if (to === cleanValue(from)) return;
    const channelAfter = classifyChannel(
      param === "utm_source" ? to : source,
      param === "utm_medium" ? to : medium,
      campaign,
    );
    suggestions.push({ param, from, to, channelBefore: before, channelAfter });
  };
  consider("utm_source", source);
  consider("utm_medium", medium);
  return suggestions;
}

/**
 * Decode a raw query value. A literal "+" stays a plus: treating it as a space
 * turned the campaign name "C++" into "c". A "%" not followed by two hex digits
 * is read as a literal percent. Invalid UTF-8 bytes are read as Latin-1.
 */
export function repairDecode(raw: string): string {
  const fixed = raw.replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
  try {
    return decodeURIComponent(fixed);
  } catch {
    return fixed.replace(/(%[0-9A-Fa-f]{2})+/g, (run) => decodeMixed(run));
  }
}

function decodeMixed(run: string): string {
  const bytes = run.split("%").filter(Boolean).map((hex) => parseInt(hex, 16));
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i] as number;
    const len = b < 0x80 ? 1 : b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0;
    if (len > 0 && i + len <= bytes.length) {
      const seq = bytes.slice(i, i + len);
      try {
        out += decodeURIComponent(seq.map((x) => "%" + x.toString(16).padStart(2, "0")).join(""));
        i += len;
        continue;
      } catch {
        // not a valid sequence: fall through to Latin-1 for this single byte
      }
    }
    out += String.fromCharCode(b);
    i += 1;
  }
  return out;
}
