# immatis

Moteur d'évaluation administrative pour l'immatriculation en France d'un véhicule importé.

Entrée : les scans d'un certificat d'immatriculation étranger. Sortie : les décisions que
l'administration française appliquera au dossier, chacune accompagnée du champ lu et de la
règle qui l'a produite.

> En construction. Le moteur de règles est incomplet, rien n'est utilisable en production.

## Principe

Le certificat d'immatriculation est harmonisé à l'échelle de l'UE (directive 1999/37/CE) :
les mêmes codes — `A`, `B`, `E`, `P.2`, `V.7`… — portent les mêmes données quel que soit
l'État émetteur, seuls les libellés changent de langue. Le pipeline s'appuie sur les codes,
jamais sur les libellés, ce qui le rend indépendant du pays.

```
scans → extraction → certificat normalisé → moteur de règles → verdicts
```

- **Extraction** — modèle de vision, sortie contrainte par un schéma JSON. Un code absent,
  illisible ou vide reste `null` : aucune valeur n'est déduite ni complétée.
- **Certificat normalisé** — un objet par code harmonisé, chacun avec son état :
  `rempli | absent_document | illisible | non_saisi`.
- **Moteur de règles** — fonctions pures sur ce certificat. Les barèmes et le catalogue des
  codes sont en JSON versionné, hors du code.
- **Verdicts** — discriminés sur `statut` : `concluant | indeterminable | bloquant`. Une
  donnée manquante produit `indeterminable`, jamais une estimation.

## Pays couverts

Allemagne, Belgique, Pays-Bas. Le format allemand (Teil I / Teil II) est la cible de
référence pour les fixtures et les cas limites.

Les autres États membres relèvent du même format harmonisé et sortiront à mesure que les
fixtures existent — le moteur n'a pas de code spécifique à un pays.

Un document non harmonisé, provisoire ou d'export sort du périmètre et renvoie
`indeterminable`.

## Périmètre v1

| Sortie | Règle | État |
| --- | --- | --- |
| Voie **RTI / AVDT** | AVDT si les 15 codes requis (A, B, C.1, D.1, D.2, D.3, E, F.1, G, H, I, P.1, P.2, P.3, S.1) sont remplis, catégorie M1/N1, document harmonisé et définitif. D.2 absent → RTI. | implémentée |
| **Radiation** | lue au verso du volet I : radié / non radié / inconnu | spécifiée |
| **TVA** | seuil sur la date de première mise en circulation (`B`) ; en deçà du seuil, la facture est requise | seuil à fixer |
| **Malus / coût du certificat** | depuis `P.2` et le CO2 (`V.7`), barème selon la méthode d'homologation | bloquée — `V.7` et la donnée d'homologation sont souvent absents du volet I |

Hors périmètre : concordance technique DREAL, chaîne de détention, contrôle technique,
historique du véhicule, FFVE, génération de pièces.

## Structure

Monorepo npm workspaces.

```
packages/core   types du certificat, catalogue des codes, évaluateur, barèmes JSON
apps/api        Hono — extraction et évaluation
apps/web        Next.js — dépôt du document, affichage des verdicts
```

## Développement

```bash
npm install
npm run dev:api   # http://localhost:3000
npm run dev:web
```

`apps/api` lit un `.env` contenant la clé d'API du fournisseur d'extraction.
