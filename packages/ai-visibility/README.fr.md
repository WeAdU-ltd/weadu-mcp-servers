# @weadu/mcp-ai-visibility

*[English version](README.md)*

> **Non publié.** Ce paquet n'est plus publié comme serveur MCP séparé. Ses contrôles sont en cours de fusion dans l'Actor Apify payant WeAdU [AI Readiness Check](https://linear.app/weadu/issue/WEA-317/actors-apify-weadu-payes-a-lusage-sur-lapify-store) ([WEA-317](https://linear.app/weadu/issue/WEA-317/actors-apify-weadu-payes-a-lusage-sur-lapify-store)). Le code reste ici pour référence ; le paquet est `private` pour que npm refuse toute publication.

Serveur MCP gratuit de [WeAdU](https://weadu.com/) qui vérifie si les robots d'IA peuvent récupérer une URL publique. Il tourne en local via stdio. Aucune clé API ni service payant.

Nécessite **Node.js 22.18 ou plus récent** (comme la racine du monorepo).

## Ce que l'outil vérifie

L'outil `check_ai_visibility` prend une URL et signale :

- la règle `robots.txt` qui s'applique à chacun de ces robots : GPTBot, ChatGPT-User, OAI-SearchBot, Google-Extended, Googlebot, PerplexityBot, ClaudeBot, anthropic-ai, Applebot-Extended, Bingbot et CCBot ;
- le statut HTTP de la page, l'URL finale et le type de contenu ;
- `noindex` via la balise meta robots ou l'en-tête `X-Robots-Tag` ;
- le titre, la meta description, l'URL canonique et les `@type` JSON-LD ;
- le statut HTTP de `/llms.txt`.

`ok` vaut true quand la page répond 200, n'est pas `noindex`, et que GPTBot et Google-Extended sont autorisés.

## Sécurité

Le serveur ne lit que des pages publiques. Il refuse les URL non HTTP, celles avec identifiant ou mot de passe, et tout hôte ou redirection vers une adresse privée, loopback, link-local ou métadonnées cloud. Il suit au plus 3 redirections, s'arrête après 8 secondes, limite la taille des réponses et n'envoie pas de cookies. User-agent : `WeAdU-AI-Visibility/1.0.0 (+https://weadu.com/)`.

## Lancer depuis le monorepo (paquet privé)

```bash
cd packages/ai-visibility
npm run build
node dist/index.js
```

## Configuration du client MCP

```json
{
  "mcpServers": {
    "weadu-ai-visibility": {
      "command": "node",
      "args": ["/chemin/absolu/vers/weadu-mcp-servers/packages/ai-visibility/dist/index.js"]
    }
  }
}
```

N'utilisez pas `npx @weadu/mcp-ai-visibility` — le paquet est privé et absent du registre npm public.

## À propos

WeAdU : https://weadu.com/

Licence : MIT.
