# weadu-mcp-servers

Serveurs MCP publics de [WeAdU](https://weadu.com/). Monorepo (npm workspaces).

**Node.js 22.18 ou plus récent** requis en local et sur les runners CI AWS (`weadu-automation`).

## Paquets

| Paquet | Nom MCP | Publication |
| --- | --- | --- |
| [`@weadu/mcp-utm-auditor`](packages/utm-auditor/) | `com.weadu/utm-auditor` | npm + [registre MCP](https://registry.modelcontextprotocol.io/) (après tag `v1.0.0` validé par Jeff) |
| [`@weadu/mcp-ai-visibility`](packages/ai-visibility/) | `com.weadu/ai-visibility` | **Non publié** — paquet privé ; fusion prévue avec l’Actor Apify payant [AI Readiness Check](https://linear.app/weadu/issue/WEA-317/actors-apify-weadu-payes-a-lusage-sur-lapify-store) ([WEA-317](https://linear.app/weadu/issue/WEA-317/actors-apify-weadu-payes-a-lusage-sur-lapify-store)). |

### Republication

Si le registre MCP est remis à zéro ou npm effacé, republier `@weadu/mcp-utm-auditor` et `com.weadu/utm-auditor` depuis une release taguée. **Le tag `v1.0.0` attend le Go de Jeff** avant tag, publication npm ou registre.

## Développement

```bash
npm ci
npm test
npm run build
```

La CI sur les PR et `main` passe par le workflow **`pr-gate`** sur `[self-hosted, weadu-automation]` (jamais `ubuntu-latest`).

Automatisations PR (auto-merge, brouillon→prêt) : [`.github/CI-AUTOMATION.md`](.github/CI-AUTOMATION.md). **Aucune fusion auto sans le label `jeff-go` ; `[HOLD]` et `attente-jeff` ne fusionnent jamais seuls.**

## À propos

WeAdU Ltd — licence MIT. Voir chaque paquet pour la documentation des outils.
