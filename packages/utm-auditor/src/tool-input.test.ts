import assert from "node:assert/strict";
import test from "node:test";
import { MAX_LIST_INPUT, MAX_URLS } from "./audit-list.ts";
import { auditListInputSchema } from "./tool-input.ts";

const MIN_UTM =
  "https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c";

test("MCP audit_utm_list input accepts more than MAX_URLS so truncated can be true", () => {
  assert.ok(MAX_LIST_INPUT > MAX_URLS);
  const over = Array.from({ length: MAX_URLS + 1 }, () => MIN_UTM);
  const parsed = auditListInputSchema.safeParse({ urls: over });
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.flatten()));
  const atCap = Array.from({ length: MAX_LIST_INPUT }, () => MIN_UTM);
  assert.equal(auditListInputSchema.safeParse({ urls: atCap }).success, true);
  const tooMany = Array.from({ length: MAX_LIST_INPUT + 1 }, () => MIN_UTM);
  assert.equal(auditListInputSchema.safeParse({ urls: tooMany }).success, false);
});
