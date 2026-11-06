# @weadu/mcp-utm-auditor

*[Version française](README.fr.md)*

A free MCP server by [WeAdU](https://weadu.com/) that audits the UTM parameters of your campaign URLs, one at a time or a few thousand at once. It runs locally over stdio and makes no network calls. The server does not send your URLs anywhere. The MCP client still receives the result, so the URLs are visible to that client and to the model provider it uses.

## Tools

Both tools return the same manual-traffic assessment. The channel follows Google's [Default channel group](https://support.google.com/analytics/answer/9756891) rules for UTM-tagged visits and the source list published on that page (copied here on 2026-10-26). It is not a reading from a GA4 property.

Three limits are on every result:

- **Manual traffic only.** [Google Ads auto-tagging](https://support.google.com/google-ads/answer/3095550) is on by default, and GA4 has no setting that lets UTM values override auto-tagging when a valid `gclid` or `dclid` is present. For tagged ad clicks the channel comes from the ad network type and the campaign type: Performance Max and Demand Gen are Cross-network, Display is Display, Video is Paid Video, and Shopping is Paid Shopping. When auto-tagging does not apply or the click id cannot be used, GA4 can fall back to UTM parameters (see [manual tagging and auto-tagging](https://support.google.com/analytics/answer/11242870)).
- **`gclid`, `wbraid`, `gbraid` and `dclid` are not read.**
- **The source list can lag the product.** A host matches a published source exactly, after a leading `www.` is removed, when a dot-suffix is a published source, or when the label before the TLD is one (`www.linkedin.com` matches `linkedin`). The file has no date. It does not list `x.com`, Threads, Discord or the AI assistants named on the same help page, so a live property can disagree.

### `audit_utm`: one URL

Reports:

- missing `utm_source`, `utm_medium` or `utm_campaign`;
- empty values, and values with leading or trailing spaces;
- the same UTM key used twice (this tool keeps the first value; Google does not document which copy GA4 keeps, and independent tests report the last);
- values longer than 200 characters (a limit of this tool, not a limit documented by Google);
- `utm_creative_format` and `utm_marketing_tactic`, which are standard parameters that Google says are not currently reported in GA4 properties (warning);
- other unknown `utm_*` keys (warning);
- values with uppercase letters, which GA4 counts apart from lowercase ones (warning). Channel rules themselves are not case sensitive;
- a `%` not followed by two hex digits, or a percent-encoding that is not valid UTF-8 (warning);
- UTM tags placed after `#`, where analytics tools do not read them (warning). A fragment that is only a query string is moved into the cleaned URL. A route such as `#/dashboard?utm_source=...` is left as it is;
- URLs that are not `http` or `https`, or that contain a username or password.

`utm_source_platform` is a standard parameter. Its letter case is kept in the cleaned URL, as is the case of `utm_id`, `utm_creative_format` and `utm_marketing_tactic`.

Keys are case-insensitive: `UTM_SOURCE` counts as `utm_source`.

The result also includes:

- **Manual GA4 channel**, plus a note when a real rule is easy to misread. A search source is evaluated before Email and SMS, so `google` / `email` is Organic Search. A campaign that matches the shop/shopping pattern is evaluated before Email. A medium that contains `mobile` (including `automobile`) matches Mobile Push Notifications. `sem` and `adwords` are not paid mediums in GA4's rule, so with source `google` they stay Organic Search. This tool does not rewrite them to `cpc`.
- **Cleaned URL.** Lower case for source, medium, campaign, term and content. Encoding repaired. A literal `+` is kept, so `C++` is not turned into `c`. Duplicate keys dropped (first value kept). UTM tags moved out of a fragment that is a query string. Other query parameters are kept. Synonyms are not applied.
- **Naming suggestions.** Optional renames such as `ppc` to `cpc` or `lnkd` to `linkedin`, each with the manual channel before and after. They are not written into the cleaned URL. There is no suggestion to rewrite `paid`, `sem`, `adwords`, `text`, `txt`, `seo`, `newsletter`, `fb`, `insta`, `li`, `pin`, `x` or `x.com`. If you change `sem`, `adwords` or `paid` to `cpc` yourself, the manual GA4 channel can change (for example `google` / `sem` becomes Paid Search, and `facebook` / `paid` stays Paid Social because `paid` already matches the paid-medium rule).

### `audit_utm_list`: up to 5,000 URLs

Runs every check above on each URL, then adds:

- **Duplicates.** `duplicate_url` for the same URL twice. `variant_url` when the URLs match once letter case is folded, which GA4 counts as separate rows. `equivalent_url` when the UTM values already match and only the parameter order, the fragment, or host/path case differs. GA4 reads the values, not their order.
- **Synonym report.** Values in the list that the remaining synonym table would group, with their counts (`LinkedIn` / `linkedin` / `lnkd`, `ppc` / `cpc`, `social-media` / `social`). The report does not change the cleaned URLs. `newsletter` left as a medium stays Unassigned: GA4's email mediums are `email`, `e-mail`, `e_mail` and `e mail`.

The response starts with a summary (totals, duplicates, URLs changed, URLs per manual channel) and the same three limits.

## Install

Requires Node.js 22.18 or later.

```bash
npx -y @weadu/mcp-utm-auditor
```

## MCP client configuration

```json
{
  "mcpServers": {
    "weadu-utm-auditor": {
      "command": "npx",
      "args": ["-y", "@weadu/mcp-utm-auditor"]
    }
  }
}
```

Then ask your assistant, for example: "Audit the UTM tags of these 300 campaign URLs and report cleaned URLs, findings, and naming suggestions."

## About

Made by [WeAdU](https://weadu.com/). License: MIT.
