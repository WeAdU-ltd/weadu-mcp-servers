# weadu-mcp-servers

Public MCP servers from [WeAdU](https://weadu.com/). Monorepo (npm workspaces).

**Requires Node.js 22.18 or later** on your machine and on the AWS self-hosted CI runners (`weadu-automation`).

## Packages

| Package | MCP name | Published |
| --- | --- | --- |
| [`@weadu/mcp-utm-auditor`](packages/utm-auditor/) | `com.weadu/utm-auditor` | npm + [MCP Registry](https://registry.modelcontextprotocol.io/) (when Jeff tags `v1.0.0`) |
| [`@weadu/mcp-ai-visibility`](packages/ai-visibility/) | `com.weadu/ai-visibility` | **Not published** — private workspace package; checks are merging into the paid [AI Readiness Check](https://linear.app/weadu/issue/WEA-317/actors-apify-weadu-payes-a-lusage-sur-lapify-store) Apify Actor ([WEA-317](https://linear.app/weadu/issue/WEA-317/actors-apify-weadu-payes-a-lusage-sur-lapify-store)). |

### Republication

If the MCP Registry is reset or npm is wiped, republish `@weadu/mcp-utm-auditor` and `com.weadu/utm-auditor` from a tagged release. **`v1.0.0` needs Jeff’s Go** before any tag, npm publish, or registry push.

## Development

```bash
npm ci
npm test
npm run build
```

CI runs on pull requests and `main` via the **`pr-gate`** workflow on `[self-hosted, weadu-automation]` (never `ubuntu-latest`).

## About

WeAdU Ltd — MIT license. See each package for tool documentation.
