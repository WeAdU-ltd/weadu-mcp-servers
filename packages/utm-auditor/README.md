# @weadu/mcp-utm-auditor

A free MCP server by [WeAdU](https://weadu.com/) that audits the UTM parameters of a campaign URL. It runs locally over stdio and makes no network calls.

## What it checks

The `audit_utm` tool takes one URL and reports:

- missing `utm_source`, `utm_medium` or `utm_campaign`;
- empty values, and values with leading or trailing spaces;
- the same UTM key used twice;
- values longer than 200 characters;
- unknown `utm_*` keys (warning);
- values with uppercase letters, which GA4 counts apart from lowercase ones (warning);
- values with a `%` not followed by two hex digits (warning);
- UTM tags placed after `#`, where analytics tools do not read them (warning);
- URLs that are not `http` or `https`, or that contain a username or password.

Keys are case-insensitive: `UTM_SOURCE` counts as `utm_source`.

## Install

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

## About

Made by WeAdU: https://weadu.com/

License: MIT.
