#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkAiVisibility } from "./check-visibility.ts";

const server = new McpServer({ name: "weadu-ai-visibility", version: "1.0.0" });

server.registerTool(
  "check_ai_visibility",
  {
    title: "AI visibility",
    description:
      "Fetch a public URL and report robots.txt rules for AI crawlers, noindex, title, canonical, JSON-LD types and llms.txt. Workspace reference only — not published on npm. Free tool by WeAdU (https://weadu.com/).",
    inputSchema: { url: z.string().min(1).max(2048) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  async ({ url }) => {
    const result = await checkAiVisibility(url);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

await server.connect(new StdioServerTransport());
