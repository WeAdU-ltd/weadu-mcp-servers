import assert from "node:assert/strict";
import test from "node:test";
import { blockReason, evaluateAutoMerge, shouldMarkDraftReady } from "./pr-merge-policy.mjs";

const base = {
  title: "WEA-123: feature",
  body: "Fixes WEA-123",
  headRef: "cursor/feature-123",
  labels: ["ci/pass", "ok-to-merge", "jeff-go"],
  draft: false,
  autoMergeEnabled: true,
  mergeable: true,
  headSha: "abc",
  gateRunSha: "abc",
};

test("[HOLD] in title blocks auto-merge", () => {
  const reason = blockReason({ ...base, title: "[HOLD] WEA-8: wait" });
  assert.equal(reason, "[HOLD] in PR title");
  const decision = evaluateAutoMerge({ ...base, title: "[HOLD] WEA-8: wait" });
  assert.equal(decision.allowed, false);
});

test("[HOLD] in body blocks auto-merge", () => {
  const decision = evaluateAutoMerge({
    ...base,
    body: "Please keep [HOLD] until Jeff says Go.",
  });
  assert.equal(decision.allowed, false);
});

test("attente-jeff label blocks auto-merge", () => {
  const decision = evaluateAutoMerge({
    ...base,
    labels: ["ok-to-merge", "jeff-go", "attente-jeff"],
  });
  assert.equal(decision.allowed, false);
});

test("pas de merge sans Go without jeff-go blocks", () => {
  assert.equal(
    blockReason({
      title: "WEA-375: CI",
      body: "Brouillon — pas de merge sans Go Jeff.",
      labels: [],
    }),
    "PR text requires Jeff Go but jeff-go label is missing",
  );
  const decision = evaluateAutoMerge({
    ...base,
    body: "Brouillon — pas de merge sans Go Jeff.",
    labels: ["ok-to-merge"],
  });
  assert.equal(decision.allowed, false);
});

test("jeff-go + ok-to-merge + flag allows merge when guards pass", () => {
  const decision = evaluateAutoMerge({ ...base });
  assert.equal(decision.allowed, true);
});

test("missing jeff-go blocks even with ok-to-merge", () => {
  const decision = evaluateAutoMerge({
    ...base,
    labels: ["ok-to-merge"],
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /jeff-go/);
});

test("auto-merge disabled when repository variable unset", () => {
  const decision = evaluateAutoMerge({ ...base, autoMergeEnabled: false });
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /WEADU_AUTO_MERGE_ENABLED/);
});

test("shouldMarkDraftReady skips hold PRs", () => {
  assert.equal(
    shouldMarkDraftReady({
      title: "[HOLD] WEA-316",
      body: "",
      labels: [],
      draft: true,
    }),
    false,
  );
  assert.equal(
    shouldMarkDraftReady({
      title: "WEA-375",
      body: "pas de merge sans accord",
      labels: [],
      draft: true,
    }),
    false,
  );
  assert.equal(
    shouldMarkDraftReady({
      title: "WEA-999",
      body: "Ready for review",
      labels: [],
      draft: true,
    }),
    true,
  );
});
