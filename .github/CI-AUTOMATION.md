# CI automation (WeAdU)

Runs on `[self-hosted, weadu-automation]` after **`pr-gate`** succeeds on a pull request.

## Auto-merge (`auto-merge-cursor-prs.yml`)

**Default: disabled.** Set repository variable `WEADU_AUTO_MERGE_ENABLED` to `true` only when Jeff wants squash auto-merge on this repo.

A PR is squash-merged only when **all** of the following hold:

| Guard | Purpose |
| --- | --- |
| `WEADU_AUTO_MERGE_ENABLED == true` | Repo-level opt-in (off on `weadu-mcp-servers` until Jeff enables) |
| `WEADU_AUTOMATION_PAT` secret | Bot can merge |
| Label `ok-to-merge` | CI/automation chain |
| Label `jeff-go` | **Explicit Go from Jeff** (add manually after review) |
| No `[HOLD]` in title, body, or branch | Blocked release / review queue |
| No label `attente-jeff` | Linear “waiting for Jeff” |
| No “pas de merge sans Go/accord” (or English equivalent) in title/body unless `jeff-go` is present | Catches draft PRs like #9/#10 without `[HOLD]` in the title |
| PR not draft, mergeable, head SHA = pr-gate run | Technical safety |

Implementation: `.github/scripts/pr-merge-policy.mjs` (unit-tested).

## Draft → ready (`cursor-draft-ready.yml`)

Uses the same **block** rules as auto-merge (hold markers, `attente-jeff`, “sans Go” text). PRs that must stay draft until Jeff’s Go are not marked ready automatically.

## Manual merge

Jeff can always merge from the GitHub UI regardless of these guards.
