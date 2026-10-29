# @weadu/mcp-utm-auditor

*[English version](README.md)*

Un serveur MCP gratuit proposé par [WeAdU](https://weadu.com/), qui audite les paramètres UTM de vos URL de campagne, une par une ou plusieurs milliers d'un coup. Il tourne en local via stdio et ne fait aucun appel réseau. Le serveur n'envoie vos URL nulle part. Le client MCP reçoit quand même le résultat : les URL sont donc visibles par ce client et par le fournisseur du modèle qu'il utilise.

## Outils

Les deux outils renvoient la même lecture du trafic manuel. Le canal suit les règles [Default channel group](https://support.google.com/analytics/answer/9756891) de Google pour les visites porteuses d'UTM, et la liste de sources publiée sur cette page (copiée ici le 26 octobre 2026). Ce n'est pas une lecture tirée d'une propriété GA4.

Trois limites figurent sur chaque résultat :

- **Trafic manuel seulement.** L'[auto-tagging Google Ads](https://support.google.com/google-ads/answer/3095550) est activé par défaut, et GA4 n'a pas de réglage qui laisserait les UTM l'emporter. Pour ces clics, le canal vient du type de réseau et du type de campagne : Performance Max et Demand Gen sont Cross-network, Display est Display, Video est Paid Video, Shopping est Paid Shopping. Voir aussi [marquage manuel et auto-tagging](https://support.google.com/analytics/answer/11242870).
- **`gclid`, `wbraid`, `gbraid` et `dclid` ne sont pas lus.**
- **La liste de sources peut être en retard sur le produit.** Un hôte correspond à une source publiée telle quelle, après retrait d'un `www.` initial, quand un suffixe après un point est une source publiée, ou quand le libellé avant le TLD en est une (`www.linkedin.com` correspond à `linkedin`). Le fichier n'a pas de date. Il ne contient ni `x.com`, ni Threads, ni Discord, ni les assistants IA cités sur la même page d'aide : une propriété réelle peut donc diverger.

### `audit_utm` : une URL

Il signale :

- l'absence de `utm_source`, `utm_medium` ou `utm_campaign` ;
- les valeurs vides, et celles qui commencent ou finissent par une espace ;
- une même clé UTM présente deux fois (cet outil garde la première valeur ; Google ne documente pas laquelle GA4 garde, et des tests indépendants indiquent la dernière) ;
- les valeurs de plus de 200 caractères (limite de cet outil, pas une limite documentée par Google) ;
- `utm_creative_format` et `utm_marketing_tactic`, paramètres standard dont Google dit qu'ils ne sont pas remontés aujourd'hui dans les propriétés GA4 (avertissement) ;
- les autres clés `utm_*` inconnues (avertissement) ;
- les valeurs avec des majuscules, que GA4 compte à part des minuscules (avertissement). Les règles de canal, elles, ne tiennent pas compte de la casse ;
- un `%` qui n'est pas suivi de deux chiffres hexadécimaux, ou un encodage pour cent qui n'est pas de l'UTF-8 valide (avertissement) ;
- les balises UTM placées après `#`, là où les outils d'analyse ne les lisent pas (avertissement). Un fragment qui n'est qu'une query est déplacé dans l'URL nettoyée. Une route comme `#/dashboard?utm_source=...` est laissée telle quelle ;
- les URL qui ne sont pas en `http` ou `https`, ou qui contiennent un identifiant ou un mot de passe.

`utm_source_platform` est un paramètre standard. Sa casse est conservée dans l'URL nettoyée, comme celle de `utm_id`, `utm_creative_format` et `utm_marketing_tactic`.

Les clés ne tiennent pas compte de la casse : `UTM_SOURCE` vaut `utm_source`.

Le résultat contient aussi :

- **Le canal GA4 manuel**, avec une note quand une règle juste est facile à mal lire. Une source de la liste search est évaluée avant Email et SMS : `google` / `email` est donc Organic Search. Une campagne qui correspond au motif shop/shopping est évaluée avant Email. Un support qui contient `mobile` (y compris `automobile`) tombe en Mobile Push Notifications. `sem` et `adwords` ne sont pas des supports payants dans la règle GA4 : avec la source `google`, ils restent en Organic Search. L'outil ne les réécrit pas en `cpc`.
- **Une URL nettoyée.** Minuscules pour la source, le support, la campagne, le terme et le contenu. Encodage réparé. Un `+` littéral est conservé : `C++` ne devient pas `c`. Clés en double retirées (première valeur gardée). Balises UTM sorties d'un fragment qui est une query. Les autres paramètres restent. Les synonymes ne sont pas appliqués.
- **Des suggestions de nommage.** Renommages facultatifs, par exemple `ppc` vers `cpc` ou `lnkd` vers `linkedin`, chacun avec le canal manuel avant et après. Ils ne sont pas écrits dans l'URL nettoyée. Aucune suggestion ne réécrit `paid`, `sem`, `adwords`, `text`, `txt`, `seo`, `newsletter`, `fb`, `insta`, `li`, `pin`, `x` ou `x.com`. Si vous passez vous-même `sem`, `adwords` ou `paid` en `cpc`, le canal GA4 manuel peut changer (par exemple `google` / `sem` devient Paid Search, et `facebook` / `paid` reste Paid Social car `paid` entre déjà dans la règle des supports payants).

### `audit_utm_list` : jusqu'à 5 000 URL

Il applique tous les contrôles ci-dessus à chaque URL, puis ajoute :

- **Les doublons.** `duplicate_url` pour une même URL présente deux fois. `variant_url` quand les URL se rejoignent une fois la casse ignorée, ce que GA4 compte comme des lignes distinctes. `equivalent_url` quand les valeurs UTM sont déjà les mêmes et que seuls l'ordre des paramètres, le fragment ou la casse de l'hôte ou du chemin diffèrent. GA4 lit les valeurs, pas leur ordre.
- **Un rapport de synonymes.** Les valeurs de la liste que la table restante regrouperait, avec leur nombre (`LinkedIn` / `linkedin` / `lnkd`, `ppc` / `cpc`, `social-media` / `social`). Le rapport ne modifie pas les URL nettoyées. Un support `newsletter` laissé tel quel reste Unassigned : les supports email de GA4 sont `email`, `e-mail`, `e_mail` et `e mail`.

La réponse commence par un résumé (totaux, doublons, URL modifiées, URL par canal manuel) et les trois mêmes limites.

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
