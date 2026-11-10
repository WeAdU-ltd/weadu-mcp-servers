import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);
const PACKAGES = join(ROOT.pathname, "packages");

const MAX_DESCRIPTION_LENGTH = 100;

test("server.json descriptions are at most 100 characters (MCP registry)", () => {
  const dirs = readdirSync(PACKAGES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const pkg of dirs) {
    const path = join(PACKAGES, pkg, "server.json");
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const { description } = JSON.parse(raw);
    assert.equal(
      typeof description,
      "string",
      `${pkg}/server.json: description must be a string`,
    );
    assert.ok(
      description.length <= MAX_DESCRIPTION_LENGTH,
      `${pkg}/server.json: description is ${description.length} chars (max ${MAX_DESCRIPTION_LENGTH}): ${description}`,
    );
  }
});
