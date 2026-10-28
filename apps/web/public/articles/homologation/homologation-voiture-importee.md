---
title: "Voiture importée : AVDT, RTI ou rien, ce que la carte grise décide"
description: "Une voiture achetée dans l'Union suit l'une de trois voies pour sa carte grise française : aucune, AVDT, ou RTI. Une rubrique de la carte grise étrangère tranche d'abord, quinze ensuite. Comment les lire."
slug: /homologation/
silo: homologation
role: pilier
status: draft
date: 2026-10-27
sources:
  - packages/core/rules.ts (getReception, isAnAVDT)
  - packages/core/json/minimal_coc.json (libellés)
  - cadre_de_recherche_immatis.md — section Certain
links:
  satellites:
    - /homologation/avdt/
    - /homologation/rti/
  next: /taxes/
---

# Voiture importée : AVDT, RTI ou rien, ce que la carte grise étrangère décide

Pour obtenir une carte grise française, une voiture achetée en Allemagne, en Belgique ou aux Pays-Bas suit l'une de trois voies : aucune démarche préalable, une attestation de vérification des données techniques (AVDT), ou une réception à titre isolé (RTI). La voie se lit sur la carte grise étrangère, en deux temps : une rubrique d'abord, quinze ensuite.

## Une carte grise de l'Union se lit par rubriques

Les cartes grises des pays de l'Union sont harmonisées : chaque information occupe une rubrique désignée par un code, le même dans tous les pays. Seul le libellé change de langue. Une carte grise peut tenir sur un à trois volets ; la lecture porte sur l'ensemble des volets, rassemblés en un seul certificat.

## Premier temps : la rubrique K

La rubrique K porte le numéro de réception par type. Si elle est renseignée, aucune démarche d'homologation n'est à prévoir : la voie est réglée.

Si K est vide, la voie dépend de quinze autres rubriques.

## Second temps : les quinze rubriques

| Rubrique | Contenu |
| --- | --- |
| A | Numéro d'immatriculation |
| B | Date de première immatriculation |
| C.1 | Titulaire du certificat |
| D.1 | Marque |
| D.2 | Type, variante, version |
| D.3 | Dénomination commerciale |
| E | Numéro d'identification du véhicule (VIN) |
| F.1 | Masse en charge maximale techniquement admissible (kg) |
| G | Masse du véhicule en service (kg) |
| H | Période de validité |
| I | Date de l'immatriculation à laquelle se réfère le certificat |
| P.1 | Cylindrée (cm³) |
| P.2 | Puissance nette maximale (kW) |
| P.3 | Type de carburant ou source d'énergie |
| S.1 | Nombre de places assises, conducteur inclus |

Les quinze renseignées : AVDT. Une seule vide : RTI. Les rubriques J (catégorie), V.7 (CO2) et V.9 (classe environnementale) ne comptent pas pour la voie.

## Les trois voies

| Ce que porte la carte grise | Voie | Coût |
| --- | --- | --- |
| K renseigné | Aucune démarche d'homologation | — |
| K vide, les quinze rubriques renseignées | AVDT | 67,38 € |
| K vide, au moins une des quinze rubriques vide | RTI | Non couvert ici |

### AVDT

L'attestation de vérification des données techniques s'applique à une voiture particulière ou à un utilitaire léger, catégories M1 et N1, muni d'un certificat d'immatriculation définitif et harmonisé d'un pays de l'Union, dont les quinze rubriques sont renseignées. Elle coûte 67,38 €.

### RTI

La réception à titre isolé s'applique dès qu'une des quinze rubriques manque sur la carte grise, K étant vide. D.2 vide conduit directement à la RTI, sans étape intermédiaire.

## Lire la carte grise avant l'achat

1. K renseigné : aucune voie.
2. K vide, les quinze rubriques renseignées : AVDT.
3. K vide, une rubrique vide parmi les quinze : RTI.

Une rubrique absente, vide ou illisible est comptée vide. Un document provisoire, d'export ou non harmonisé ne permet pas la lecture : la voie est indéterminable.

## Lexique

| Terme | Définition |
| --- | --- |
| Rubrique | Case codée d'une carte grise de l'Union ; même code dans tous les pays |
| Numéro de réception par type | Rubrique K |
| Type, variante, version | Rubrique D.2 |
| Certificat d'immatriculation définitif et harmonisé | Carte grise définitive d'un pays de l'Union, ni provisoire ni d'export |
| M1, N1 | Catégories des voitures particulières et des utilitaires légers |
| AVDT | Attestation de vérification des données techniques |
| RTI | Réception à titre isolé |

## Immatis

Immatis lit la carte grise étrangère seule, un à trois volets, sans compte ni champ à remplir, et indique la voie. Chaque verdict affiche la rubrique lue et la règle appliquée. Une donnée absente du document rend le verdict indéterminable.
