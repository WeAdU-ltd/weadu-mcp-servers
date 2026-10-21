#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { auditUtm } from "./audit-utm.ts";
import { auditUtmList, MAX_URLS } from "./audit-list.ts";

const server = new McpServer({ name: "weadu-utm-auditor", version: "1.0.0" });

server.registerTool(
  "audit_utm",
  {
    title: "Audit UTM",
    description:
      "Check that a campaign URL includes utm_source, utm_medium and utm_campaign, and flag empty values, duplicates, unknown utm_* keys and UTM tags left in the URL fragment. Free tool by WeAdU.",
    inputSchema: { url: z.string().min(1).max(2048) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ url }) => {
    const result = auditUtm(url);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "audit_utm_list",
  {
    title: "Audit a list of UTM URLs",
    description:
      `Audit up to ${MAX_URLS} campaign URLs at once. For each URL: UTM errors and warnings, the GA4 default channel it lands in (warning when Unassigned), duplicates, and a suggested corrected URL (lowercase, synonyms such as fb/facebook or ppc/cpc normalized, encoding repaired). Also lists synonym variants across the list. Free tool by WeAdU.`,
    inputSchema: { urls: z.array(z.string().max(2048)).min(1).max(MAX_URLS) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ urls }) => {
    const result = auditUtmList(urls);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

await server.connect(new StdioServerTransport());
