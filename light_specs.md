# Immatis — récap projet (09/09/2026)

## Produit

Outil web qui lit un certificat d'immatriculation étranger (prioritairement allemand, Teil I / Teil II) et annonce ce que l'administration française va décider, avant l'achat.

Positionnement : anti-refus, pas guide de démarches. Formule validée : « Passez du premier coup ».
Baseline candidate : « Lisez la carte grise avant d'acheter la voiture ».

Contraintes :
- entrée = le document, rien d'autre. Pas de formulaire, pas de compte, pas d'e-mail, pas de relance.
- chaque sortie affiche le champ lu et la règle appliquée.
- toute question posée à l'utilisateur doit être justifiée par une donnée absente du document.

Modèle de référence : klari.fr (outil anti-refus MDPH, gratuit).

## Périmètre v1 — arrêté

Quatre sorties, dérivées du certificat seul.

1. **Voie : RTI ou AVDT**
   - AVDT si : 15 champs harmonisés complets (A, B, C.1, D.1, D.2, D.3, E, F.1, G, H, I, P.1, P.2, P.3, S.1), catégorie M1/N1, document harmonisé UE et définitif (ni provisoire, ni export).
   - D.2 absent → RTI direct, pas d'étape COC.
   - Document non harmonisé ou non définitif → sortie non calculable.
2. **Radiation** — lue au verso du Teil I. Valeurs : radié / non radié / inconnu.
3. **TVA** — décision du 09/09 : seuil sur la date de première mise en circulation (champ B). Au-delà du seuil : aucune question. En deçà : demande de la facture, qui apporte en une pièce les trois données absentes du CI (kilométrage, date de livraison, régime TVA du vendeur). Seuil exact à fixer.
4. **CV / coût carte grise** — repose sur P.2 et CO2. Blocage : CO2 et donnée d'homologation souvent absents du Teil I ; deux formules selon la date d'homologation. Non résolu.

Hors v1 : concordance véhicule (DREAL), chaîne de détention, CT, historique, FFVE / collection, génération de pièces.

## Non tranché

- seuil de déclenchement de la demande de facture
- présence réelle du CO2 et de la donnée d'homologation sur un Teil I
- sortie CV : formule applicable, ou repli sur `indeterminable`
- idée non validée : lire les détenteurs successifs sur le Teil II pour alerter sur une TVA sur marge à risque quand tous sont des sociétés

## Technique — décisions prises

- Stack : TypeScript, Next.js, Express.
- État d'un champ : `rempli | absent_document | illisible | non_saisi`.
- Verdict d'une sortie : discriminé sur `statut` : `concluant | indeterminable | bloquant`.
- Règles en JSON versionné, pas en dur dans le code.
- Ordre de build : types + évaluateur pur + fixtures de test → Express → formulaire Next → base de données.
- Logique métier portée par les objets (règle écrite une fois), pas dupliquée dans les fonctions.

## Marque

- Nom : Immatis (SAS française dissoute 2016, pas de marque active).
- Wordmark « immatis » minuscules sans-serif géométrique : OK. Symbole radial : à refaire.
- À éviter : « simplifiez vos démarches », « expert », « accompagnement ».

## Distribution (post-build)

- SEO long-tail : une page par motif de refus verbatim, fautes d'orthographe des termes allemands, questions paradoxales non résolues (CT ↔ CG, quitus pour WW).
- Forums et Reddit (r/voiture, Caroom, forums de marque) en REX datés et chiffrés.

## Méthode de travail

- Valider d'abord, construire ensuite, réglementer après.
- Réduction plutôt qu'extension de périmètre.
- Dire l'incertitude, ne pas combler les trous.
- Pas de recherche juridique, pas de citation de textes, pas de code ni de modèle de données non demandés.