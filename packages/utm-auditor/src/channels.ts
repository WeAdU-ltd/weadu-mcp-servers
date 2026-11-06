// GA4 "Default channel group" rules for manual (UTM-tagged) traffic, in the
// order Google evaluates them.
// https://support.google.com/analytics/answer/9756891
// Source lists: ./ga4-sources.ts, copied from the file linked on that page.

import { SEARCH, SHOPPING, SOCIAL, VIDEO } from "./ga4-sources.ts";

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

const PAID_MEDIUM = /^(.*cp.*|ppc|retargeting|paid.*)$/;
const SHOP_CAMPAIGN = /^(.*(([^a-df-z]|^)shop|shopping).*)$/;
const DISPLAY = ["display", "banner", "expandable", "interstitial", "cpm"];
const SOCIAL_MEDIUM = ["social", "social-network", "social-media", "sm", "social network", "social media"];
const EMAIL = ["email", "e-mail", "e_mail", "e mail"];

/**
 * Literal match against the published list. Also accepts a leading www.,
 * a longer host whose dot-suffix is a published source (foo.news.ycombinator.com),
 * and the label before the TLD when that label is itself a published source
 * (www.google.com matches google). A source such as google.evil.com does not match.
 */
export function inList(source: string, list: ReadonlySet<string>): boolean {
  if (source === "") return false;
  if (list.has(source)) return true;
  const bare = source.startsWith("www.") ? source.slice(4) : source;
  if (bare !== source && list.has(bare)) return true;
  const labels = source.split(".");
  if (labels.length < 2) return false;
  for (let i = 1; i < labels.length - 1; i++) {
    const suffix = labels.slice(i).join(".");
    if (list.has(suffix)) return true;
  }
  const sld = labels[labels.length - 2];
  return sld !== undefined && list.has(sld);
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

/** Notes for manual-rule results that are right and easy to misread. */
export function ruleOrderNotes(sourceIn: string, mediumIn: string, campaignIn: string, channel: Ga4Channel): string[] {
  const source = sourceIn.trim().toLowerCase();
  const medium = mediumIn.trim().toLowerCase();
  const campaign = campaignIn.trim().toLowerCase();
  const notes: string[] = [];
  if (channel === "Organic Search" && inList(source, SEARCH) && (EMAIL.includes(medium) || medium === "sms")) {
    notes.push(
      `Source "${sourceIn.trim()}" is on GA4's published search list. That rule is evaluated before Email and SMS, so the manual channel is Organic Search.`,
    );
  }
  if ((channel === "Organic Shopping" || channel === "Paid Shopping") && SHOP_CAMPAIGN.test(campaign) && !inList(source, SHOPPING)) {
    notes.push(
      `Campaign "${campaignIn.trim()}" matches GA4's shop/shopping pattern. Shopping rules are evaluated before Email and several other channels, so the manual channel is ${channel}.`,
    );
  }
  if (
    channel === "Mobile Push Notifications" &&
    medium.includes("mobile") &&
    !medium.endsWith("push") &&
    !medium.includes("notification") &&
    source !== "firebase"
  ) {
    notes.push(
      `GA4's mobile-push rule matches any medium that contains "mobile". "${mediumIn.trim()}" hits that rule, so the manual channel is Mobile Push Notifications.`,
    );
  }
  if (medium === "sem" || medium === "adwords") {
    notes.push(
      `utm_medium "${mediumIn.trim()}" is not in GA4's paid-medium rule (a value that contains "cp", or ppc, retargeting, or a value that starts with "paid"). The manual channel is ${channel}. This tool does not rewrite it to cpc.`,
    );
  }
  return notes;
}
