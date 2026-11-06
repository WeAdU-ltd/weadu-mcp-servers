#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { auditUtm } from "./audit-utm.ts";
import { auditUtmList, MAX_URLS } from "./audit-list.ts";
import { AUDIT_LIST_DESCRIPTION, AUDIT_UTM_DESCRIPTION } from "./ga4-copy.ts";

const server = new McpServer({ name: "weadu-utm-auditor", version: "1.0.0" });

server.registerTool(
  "audit_utm",
  {
    title: "Audit UTM",
    description: AUDIT_UTM_DESCRIPTION,
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
    description: AUDIT_LIST_DESCRIPTION.replace("5000", String(MAX_URLS)),
    inputSchema: { urls: z.array(z.string().max(2048)).min(1).max(MAX_URLS) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  async ({ urls }) => {
    const result = auditUtmList(urls);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

await server.connect(new StdioServerTransport());
