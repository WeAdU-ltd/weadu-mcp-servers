/**
 * Shared PR automation policy (auto-merge + draft-ready).
 * WEA-376: never merge [HOLD] / attente-jeff / without explicit jeff-go.
 */

/** @typedef {{ title?: string; body?: string | null; headRef?: string; labels?: string[]; draft?: boolean; autoMergeEnabled?: boolean }} PrContext */

const HOLD_TITLE_RE = /\[HOLD\]/i;
const HOLD_BODY_RE = /\[HOLD\]/i;
const NO_MERGE_WITHOUT_GO_RE =
  /\bpas de merge sans (?:go|accord)\b|\bno merge without (?:go|approval)\b/i;

/**
 * @param {PrContext} ctx
 * @returns {string | null}
 */
export function blockReason(ctx) {
  const title = ctx.title ?? "";
  const body = ctx.body ?? "";
  const headRef = ctx.headRef ?? "";
  const labels = (ctx.labels ?? []).map((name) => name.toLowerCase());

  if (HOLD_TITLE_RE.test(title)) {
    return "[HOLD] in PR title";
  }
  if (HOLD_BODY_RE.test(body)) {
    return "[HOLD] in PR body";
  }
  if (/\[HOLD\]/i.test(headRef)) {
    return "[HOLD] in branch name";
  }
  if (labels.includes("attente-jeff")) {
    return "attente-jeff label";
  }
  if (NO_MERGE_WITHOUT_GO_RE.test(`${title}\n${body}`) && !labels.includes("jeff-go")) {
    return "PR text requires Jeff Go but jeff-go label is missing";
  }
  return null;
}

/**
 * @param {PrContext} ctx
 */
export function shouldMarkDraftReady(ctx) {
  if (blockReason(ctx)) {
    return false;
  }
  if (ctx.draft !== true) {
    return false;
  }
  return true;
}

/**
 * @param {PrContext & { mergeable?: boolean | null; headSha?: string; gateRunSha?: string }} ctx
 * @returns {{ allowed: boolean; reason: string }}
 */
export function evaluateAutoMerge(ctx) {
  const blocked = blockReason(ctx);
  if (blocked) {
    return { allowed: false, reason: blocked };
  }
  if (ctx.autoMergeEnabled !== true) {
    return {
      allowed: false,
      reason:
        "WEADU_AUTO_MERGE_ENABLED repository variable is not true (auto-merge disabled for this repo)",
    };
  }
  const labels = (ctx.labels ?? []).map((name) => name.toLowerCase());
  if (!labels.includes("ok-to-merge")) {
    return { allowed: false, reason: "missing ok-to-merge label" };
  }
  if (!labels.includes("jeff-go")) {
    return { allowed: false, reason: "missing jeff-go label (explicit Go from Jeff)" };
  }
  if (ctx.draft === true) {
    return { allowed: false, reason: "PR is still draft" };
  }
  if (ctx.mergeable === false) {
    return { allowed: false, reason: "PR not mergeable" };
  }
  if (ctx.headSha && ctx.gateRunSha && ctx.headSha !== ctx.gateRunSha) {
    return { allowed: false, reason: "PR head SHA differs from pr-gate run" };
  }
  return { allowed: true, reason: "all guards passed" };
}
