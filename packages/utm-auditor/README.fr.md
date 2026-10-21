# @weadu/mcp-utm-auditor

*[English version](README.md)*

Un serveur MCP gratuit proposé par [WeAdU](https://weadu.com/), qui audite les paramètres UTM de vos URL de campagne, une par une ou plusieurs milliers d'un coup. Il tourne en local via stdio et ne fait aucun appel réseau : vos URL ne quittent jamais votre machine.

## Outils

### `audit_utm` : une URL

Il signale :

- l'absence de `utm_source`, `utm_medium` ou `utm_campaign` ;
- les valeurs vides, et celles qui commencent ou finissent par une espace ;
- une même clé UTM présente deux fois ;
- les valeurs de plus de 200 caractères ;
- les clés `utm_*` inconnues (avertissement) ;
- les valeurs avec des majuscules, que GA4 compte à part des minuscules (avertissement) ;
- les valeurs avec un `%` qui n'est pas suivi de deux chiffres hexadécimaux, ou qui ne sont pas de l'UTF-8 valide (avertissement) ;
- les balises UTM placées après `#`, là où les outils d'analyse ne les lisent pas (avertissement) ;
- les URL qui ne sont pas en `http` ou `https`, ou qui contiennent un identifiant ou un mot de passe.

Les clés ne tiennent pas compte de la casse : `UTM_SOURCE` vaut `utm_source`.

### `audit_utm_list` : jusqu'à 5 000 URL

Il applique tous les contrôles ci-dessus à chaque URL, puis ajoute :

- **Le canal GA4.** Le canal par défaut que GA4 attribue, selon les règles [Default channel group](https://support.google.com/analytics/answer/9756891) de Google pour le trafic manuel. Si une URL ne tombe dans aucun canal (par exemple `utm_medium=newsletter` ou `web`), vous recevez un avertissement `ga4_unassigned`, avec un medium suggéré quand il en existe un.
- **Les doublons.** `duplicate_url` pour une même URL présente deux fois. `variant_url` pour des URL qui ne diffèrent que par la casse ou par des synonymes, et que GA4 séparerait en plusieurs lignes.
- **Les synonymes.** Les valeurs qui veulent dire la même chose dans la liste, avec leur nombre : `LinkedIn` / `linkedin` / `lnkd`, `fb` / `facebook`, `cpc` / `ppc` / `paid`, `social-media` / `social`, etc.
- **Une URL corrigée.** Pour chaque URL, une version corrigée : valeurs en minuscules, synonymes normalisés, encodage réparé, clés en double retirées, balises UTM sorties du fragment. Les autres paramètres sont conservés tels quels.
- **À propos de `paid`.** Dans l'URL corrigée, le support `paid` est remplacé par `cpc`. Vérifiez que cela correspond à votre plan de nommage avant de réutiliser l'URL. Les règles par défaut de GA4 rangent les deux valeurs dans les mêmes canaux payants, mais un groupe de canaux personnalisé ou un rapport filtré sur `paid` verrait la différence. Les valeurs `sem` et `adwords` sont elles aussi remplacées par `cpc`, et pour elles le canal GA4 change vraiment : la règle des supports payants de GA4 ne les reconnaît pas, donc `sem` avec la source `google` tombe aujourd'hui en Organic Search et passe en Paid Search une fois corrigé.

La réponse commence par un résumé : totaux, doublons, URL modifiées et nombre d'URL par canal GA4.

Les listes de sites derrière les règles de canal (moteurs de recherche, réseaux sociaux, vidéo, shopping) sont une sélection de la liste publiée par Google. Il peut donc arriver qu'un site rare reçoive un autre canal dans GA4.

## Installation

Nécessite Node.js 22.18 ou plus récent.

```bash
npx -y @weadu/mcp-utm-auditor
```

## Configuration du client MCP

```json
{
  "mcpServers": {
    "weadu-utm-auditor": {
      "command": "npx",
      "args": ["-y", "@weadu/mcp-utm-auditor"]
    }
  }
}
```

Demandez ensuite à votre assistant, par exemple : « Audite les UTM de ces 300 URL de campagne et donne-moi la liste corrigée. »

## À propos

Conçu par [WeAdU](https://weadu.com/). Licence : MIT.
