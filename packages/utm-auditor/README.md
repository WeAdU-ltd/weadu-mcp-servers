# @weadu/mcp-utm-auditor

*[Version française](README.fr.md)*

A free MCP server by [WeAdU](https://weadu.com/) that audits the UTM parameters of your campaign URLs, one at a time or a few thousand at once. It runs locally over stdio and makes no network calls: your URLs never leave your machine.

## Tools

### `audit_utm`: one URL

Reports:

- missing `utm_source`, `utm_medium` or `utm_campaign`;
- empty values, and values with leading or trailing spaces;
- the same UTM key used twice;
- values longer than 200 characters;
- unknown `utm_*` keys (warning);
- values with uppercase letters, which GA4 counts apart from lowercase ones (warning);
- values with a `%` not followed by two hex digits, or that are not valid UTF-8 (warning);
- UTM tags placed after `#`, where analytics tools do not read them (warning);
- URLs that are not `http` or `https`, or that contain a username or password.

Keys are case-insensitive: `UTM_SOURCE` counts as `utm_source`.

### `audit_utm_list`: up to 5,000 URLs

Runs every check above on each URL, then adds:

- **GA4 channel.** The default channel GA4 assigns, following Google's [Default channel group](https://support.google.com/analytics/answer/9756891) rules for manual traffic. When a URL lands in no channel (for example `utm_medium=newsletter` or `web`), you get a `ga4_unassigned` warning, with a suggested medium when one fits.
- **Duplicates.** `duplicate_url` for the same URL twice. `variant_url` for URLs that only differ by case or synonyms, which GA4 would split into separate rows.
- **Synonyms.** Values that mean the same thing across the list, with their counts: `LinkedIn` / `linkedin` / `lnkd`, `fb` / `facebook`, `cpc` / `ppc` / `paid`, `social-media` / `social`, and more.
- **Suggested URL.** A corrected URL for each item: values in lowercase, synonyms normalized, encoding repaired, duplicate keys dropped, UTM tags moved out of the fragment. Other query parameters are kept as they are.

The response starts with a summary: totals, duplicates, URLs changed, and the number of URLs per GA4 channel.

The source lists behind the channel rules (search, social, video and shopping sites) are a curated subset of Google's published list. A rare site may therefore get a different channel in GA4.

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

Then ask your assistant, for example: "Audit the UTM tags of these 300 campaign URLs and give me the corrected list."

## About

Made by [WeAdU](https://weadu.com/). License: MIT.
