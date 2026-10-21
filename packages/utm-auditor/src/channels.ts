// GA4 "Default channel group" rules for manual (UTM-tagged) traffic, in the
// order Google evaluates them. Source: https://support.google.com/analytics/answer/9756891
// The source lists are a curated subset of Google's published spreadsheet of
// search, social, video and shopping sites.

export type Ga4Channel =
  | "Direct"
  | "Cross-network"
  | "Paid Shopping"
  | "Paid Search"
  | "Paid Social"
  | "Paid Video"
  | "Display"
  | "Paid Other"
  | "Organic Shopping"
  | "Organic Social"
  | "Organic Video"
  | "Organic Search"
  | "AI Assistant"
  | "Referral"
  | "Email"
  | "Affiliates"
  | "Audio"
  | "SMS"
  | "Mobile Push Notifications"
  | "Unassigned";

const SEARCH = ["google", "bing", "yahoo", "baidu", "duckduckgo", "yandex", "ecosia", "qwant", "naver", "ask", "aol", "startpage", "search.brave", "seznam", "sogou", "so.com", "daum", "msn", "avg", "lycos", "dogpile", "ekolay", "kvasir", "mail.ru", "rambler", "onet", "wp.pl"];
const SOCIAL = ["facebook", "fb", "m.facebook.com", "l.facebook.com", "lm.facebook.com", "instagram", "ig", "l.instagram.com", "linkedin", "lnkd.in", "twitter", "t.co", "x.com", "pinterest", "reddit", "snapchat", "threads", "threads.net", "whatsapp", "tumblr", "quora", "discord", "discord.com", "telegram", "t.me", "mastodon", "messenger", "vk.com", "weibo", "wechat", "line", "meetup", "nextdoor", "bluesky", "bsky.app", "medium.com", "slack", "yelp", "tiktok"];
const VIDEO = ["youtube", "youtube.com", "m.youtube.com", "youtu.be", "vimeo", "vimeo.com", "tiktok", "tiktok.com", "twitch", "twitch.tv", "dailymotion", "dailymotion.com", "wistia", "wistia.com", "netflix", "disneyplus", "hulu", "ted.com"];
const SHOPPING = ["amazon", "amazon.com", "ebay", "ebay.com", "etsy", "etsy.com", "shopify", "shopify.com", "walmart", "walmart.com", "google shopping", "igshopping", "aliexpress", "alibaba", "mercadolibre", "rakuten", "stripe", "shopzilla", "shop.app"];

const PAID_MEDIUM = /^(.*cp.*|ppc|retargeting|paid.*)$/;
const SHOP_CAMPAIGN = /^(.*(([^a-df-z]|^)shop|shopping).*)$/;
const DISPLAY = ["display", "banner", "expandable", "interstitial", "cpm"];
const SOCIAL_MEDIUM = ["social", "social-network", "social-media", "sm", "social network", "social media"];
const EMAIL = ["email", "e-mail", "e_mail", "e mail"];

function inList(source: string, list: readonly string[]): boolean {
  if (source === "") return false;
  if (list.includes(source)) return true;
  // A host such as "www.linkedin.com" or "m.facebook.com" matches the site name.
  const labels = source.split(".");
  return labels.length > 1 && list.some((site) => !site.includes(".") && !site.includes(" ") && labels.slice(0, -1).includes(site));
}

export function classifyChannel(sourceIn: string, mediumIn: string, campaignIn = ""): Ga4Channel {
  const source = sourceIn.trim().toLowerCase();
  const medium = mediumIn.trim().toLowerCase();
  const campaign = campaignIn.trim().toLowerCase();
  const paid = PAID_MEDIUM.test(medium);
  const shopping = inList(source, SHOPPING) || SHOP_CAMPAIGN.test(campaign);

  if (source === "(direct)" && (medium === "(not set)" || medium === "(none)")) return "Direct";
  if (campaign.includes("cross-network")) return "Cross-network";
  if (shopping && paid) return "Paid Shopping";
  if (inList(source, SEARCH) && paid) return "Paid Search";
  if (inList(source, SOCIAL) && paid) return "Paid Social";
  if (inList(source, VIDEO) && paid) return "Paid Video";
  if (DISPLAY.includes(medium)) return "Display";
  if (paid) return "Paid Other";
  if (shopping) return "Organic Shopping";
  if (inList(source, SOCIAL) || SOCIAL_MEDIUM.includes(medium)) return "Organic Social";
  if (inList(source, VIDEO) || /^(.*video.*)$/.test(medium)) return "Organic Video";
  if (inList(source, SEARCH) || medium === "organic") return "Organic Search";
  if (medium === "ai-assistant") return "AI Assistant";
  if (["referral", "app", "link"].includes(medium)) return "Referral";
  if (EMAIL.includes(source) || EMAIL.includes(medium)) return "Email";
  if (medium === "affiliate") return "Affiliates";
  if (medium === "audio") return "Audio";
  if (source === "sms" || medium === "sms") return "SMS";
  if (medium.endsWith("push") || medium.includes("mobile") || medium.includes("notification") || source === "firebase") {
    return "Mobile Push Notifications";
  }
  return "Unassigned";
}

/** True when the medium alone places traffic in a GA4 channel, whatever the source. */
export function mediumHasChannel(medium: string): boolean {
  return classifyChannel("", medium, "") !== "Unassigned";
}
