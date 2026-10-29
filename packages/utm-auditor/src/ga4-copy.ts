/** Copy shared by the tools, the JSON results, and the tests. */
export const GA4_SCOPE = "manual_traffic" as const;

/**
 * Three limits that every result carries. They match Google's manual-traffic
 * rules and the auto-tagging pages cited in the README.
 */
export const GA4_CAVEATS = [
  "Manual traffic only: this channel is the GA4 default channel group for UTM-tagged visits, using Google's published source list and rule order. It is not a reading from a GA4 property.",
  "Google Ads auto-tagging is on by default, and GA4 has no setting that lets UTM values override it. For those clicks the channel comes from the ad network type and the campaign type: Performance Max and Demand Gen are Cross-network, Display is Display, Video is Paid Video, and Shopping is Paid Shopping.",
  "gclid, wbraid, gbraid and dclid are not read.",
] as const;

const LIMITS = GA4_CAVEATS.join(" ");

export const AUDIT_UTM_DESCRIPTION =
  "Check one campaign URL for missing utm_source, utm_medium or utm_campaign, empty values, duplicate keys, unknown utm_* keys, encoding, and UTM tags left in the fragment. Returns the manual-traffic GA4 channel, a mechanically cleaned URL (lowercase, encoding, duplicate keys, query-like fragments; synonyms are not applied), and optional naming suggestions with the channel before and after. " +
  LIMITS +
  " Free tool by WeAdU.";

export const AUDIT_LIST_DESCRIPTION =
  "Audit up to 5000 campaign URLs (send more and the JSON sets truncated: true; only the first 5000 are processed). For each URL: the same checks as audit_utm, the manual-traffic GA4 channel, a mechanically cleaned URL, and naming suggestions that are not applied to that URL. Also reports duplicates and synonym groups. " +
  LIMITS +
  " Free tool by WeAdU.";
