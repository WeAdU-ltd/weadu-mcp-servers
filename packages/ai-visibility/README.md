# @weadu/mcp-ai-visibility

> **Not published.** This package is no longer released as a separate MCP server. Its checks are being merged into the WeAdU "AI Readiness Check" Apify Actor. The code stays here for reference, and the package is marked `private` so npm refuses to publish it.

A free MCP server by [WeAdU](https://weadu.com/) that checks whether AI crawlers can fetch a public URL. It runs locally over stdio. It needs no API key and calls no paid service.

## What it checks

The `check_ai_visibility` tool takes one URL and reports:

- the `robots.txt` rule that applies to each of these crawlers: GPTBot, ChatGPT-User, OAI-SearchBot, Google-Extended, Googlebot, PerplexityBot, ClaudeBot, anthropic-ai, Applebot-Extended, Bingbot and CCBot;
- the page status, final URL and content type;
- `noindex` from the robots meta tag or the `X-Robots-Tag` header;
- the page title, meta description, canonical URL and JSON-LD `@type` values;
- the HTTP status of `/llms.txt`.

`ok` is true when the page answers 200, is not `noindex`, and both GPTBot and Google-Extended are allowed.

## Safety

The server only reads public pages. It refuses non-HTTP URLs, URLs with a username or password, and any host or redirect that resolves to a private, loopback, link-local or cloud metadata address. It follows at most 3 redirects, stops after 8 seconds, caps response sizes and sends no cookies. Requests use the user agent `WeAdU-AI-Visibility/1.0.0 (+https://weadu.com/)`.

## Install

```bash
npx -y @weadu/mcp-ai-visibility
```

## MCP client configuration

```json
{
  "mcpServers": {
    "weadu-ai-visibility": {
      "command": "npx",
      "args": ["-y", "@weadu/mcp-ai-visibility"]
    }
  }
}
```

## About

Made by WeAdU: https://weadu.com/

License: MIT.
