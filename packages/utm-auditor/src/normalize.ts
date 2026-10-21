// Synonym tables used to suggest one canonical value per source and medium.
const SOURCE_SYNONYMS: Record<string, string[]> = {
  linkedin: ["linkedin", "lnkd", "lnkd.in", "li", "linked_in", "linked-in", "linkedin.com", "www.linkedin.com"],
  facebook: ["facebook", "fb", "fbook", "facebook.com", "www.facebook.com", "m.facebook.com", "l.facebook.com"],
  instagram: ["instagram", "ig", "insta", "instagram.com", "www.instagram.com", "l.instagram.com"],
  twitter: ["twitter", "tw", "twitter.com", "x", "x.com", "t.co"],
  youtube: ["youtube", "yt", "youtube.com", "www.youtube.com", "youtu.be"],
  google: ["google", "google.com", "www.google.com", "googleads", "google_ads", "google-ads", "adwords"],
  bing: ["bing", "bing.com", "microsoft_ads", "microsoft-ads", "msads"],
  tiktok: ["tiktok", "tik_tok", "tik-tok", "tiktok.com"],
  pinterest: ["pinterest", "pin", "pinterest.com"],
  reddit: ["reddit", "reddit.com"],
  email: ["email", "e-mail", "e_mail", "e mail", "mail"],
  newsletter: ["newsletter", "news_letter", "news-letter", "nl"],
};

const MEDIUM_SYNONYMS: Record<string, string[]> = {
  cpc: ["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search", "sem", "adwords"],
  "paid-social": ["paid-social", "paid_social", "paidsocial", "social_paid", "social-paid"],
  social: ["social", "social-media", "social_media", "socialmedia", "social media", "social-network", "social_network", "social network", "sm", "organic_social", "organic-social"],
  email: ["email", "e-mail", "e_mail", "e mail", "mail", "newsletter", "emailing"],
  affiliate: ["affiliate", "affiliates", "aff", "affiliation"],
  referral: ["referral", "ref", "referer", "referrer"],
  display: ["display", "banner", "banners"],
  organic: ["organic", "seo"],
  sms: ["sms", "text", "txt"],
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

/** Decode a raw query value, turning stray % signs into literal ones instead of failing. */
export function repairDecode(raw: string): string {
  const fixed = raw.replace(/\+/g, " ").replace(/%(?![0-9A-Fa-f]{2})/g, "%25");
  try {
    return decodeURIComponent(fixed);
  } catch {
    // Escapes that are not valid UTF-8 (often Latin-1, e.g. %E9 for "é"): decode those bytes as Latin-1.
    return fixed.replace(/(%[0-9A-Fa-f]{2})+/g, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        return run
          .split("%")
          .filter(Boolean)
          .map((hex) => String.fromCharCode(parseInt(hex, 16)))
          .join("");
      }
    });
  }
}
