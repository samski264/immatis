// Contenu des trois écrans blog dessinés dans design/immatis.pen.
// Seules les pages présentes dans la maquette ont une route.

export const FILTERS = [
  { id: "tous", label: "Tous" },
  { id: "rti-avdt", label: "RTI ou AVDT" },
  { id: "malus", label: "Malus et abattement" },
  { id: "tva", label: "TVA et quitus fiscal" },
];

export const TONES = {
  neutral: { ink: "#3A3A3A", bg: "#E7E7E7" },
  lime: { ink: "#273E00", bg: "#C8F57A" },
  sky: { ink: "#0E3A4F", bg: "#D9F3FF" },
};

export const INDEX = [
  {
    title: "RTI ou AVDT : qu'est-ce qui décide de la voie de mon dossier ?",
    meta: "RTI ou AVDT · 14 oct. 2026 · 9 min",
    dossier: "rti-avdt",
    tone: "neutral",
    scene: 1,
    href: "/blog/rti-avdt",
  },
  {
    title: "Combien de malus vais-je payer sur une voiture importée ?",
    meta: "Malus et abattement · 12 oct. 2026 · 11 min",
    dossier: "malus",
    tone: "lime",
    scene: 3,
  },
  {
    title: "Vais-je payer la TVA sur une voiture achetée dans l'UE ?",
    meta: "TVA et quitus fiscal · 9 oct. 2026 · 10 min",
    dossier: "tva",
    tone: "sky",
    scene: 4,
  },
  {
    title: "AVDT, c'est quoi ?",
    meta: "RTI ou AVDT · 7 oct. 2026 · 4 min",
    dossier: "rti-avdt",
    tone: "neutral",
    scene: 0,
  },
  {
    title: "L'abattement du malus, c'est quoi et comment le calculer ?",
    meta: "Malus et abattement · 5 oct. 2026 · 5 min",
    dossier: "malus",
    tone: "lime",
    scene: 3,
  },
  {
    title: "Le quitus fiscal, c'est quoi et où l'obtenir ?",
    meta: "TVA et quitus fiscal · 2 oct. 2026 · 5 min",
    dossier: "tva",
    tone: "sky",
    scene: 4,
  },
  {
    title: "RTI, c'est quoi ?",
    meta: "RTI ou AVDT · 29 sept. 2026 · 5 min",
    dossier: "rti-avdt",
    tone: "neutral",
    scene: 2,
  },
  {
    title: "Le malus au poids, c'est quoi ?",
    meta: "Malus et abattement · 26 sept. 2026 · 6 min",
    dossier: "malus",
    tone: "lime",
    scene: 3,
  },
  {
    title: "6 mois et 6 000 km : ma voiture est neuve ou d'occasion pour le fisc ?",
    meta: "TVA et quitus fiscal · 23 sept. 2026 · 5 min",
    dossier: "tva",
    tone: "sky",
    scene: 4,
  },
];

const RTI = {
  slug: "rti-avdt",
  label: "RTI ou AVDT",
  eyebrow: "Dossier 01 · voie d'immatriculation",
  title: "RTI ou AVDT : qu'est-ce qui décide de la voie de mon dossier ?",
  intro:
    "La DREAL ne lit pas votre dossier, elle lit la carte grise. Quinze champs harmonisés, la catégorie et le caractère définitif du document décident entre l'attestation de vérification des données techniques et la réception à titre isolé.",
  rule: {
    eyebrow: "En bref",
    title: "Qu'est-ce qui envoie mon dossier en AVDT plutôt qu'en RTI ?",
    text: "Trois conditions, toutes lues sur le certificat d'immatriculation étranger. Les trois sont vraies : AVDT. Une seule manque : RTI.",
  },
  sources: [
    "Fiche de constitution de dossier AVDT, DREAL Nouvelle-Aquitaine (2024) : conditions, catégories M1 et N1, coût de 67,38 €",
    "Fiche AVDT, DREAL Grand Est : titre définitif et harmonisé CE, pièces du dossier",
    "Directive 1999/37/CE du Conseil : codes harmonisés des certificats d'immatriculation",
    "Réception à titre isolé (art. R.321-15 du Code de la route) : plaquette usagers, DREAL Centre-Val de Loire",
  ],
  articles: [
    {
      n: "01",
      title: "RTI ou AVDT : qu'est-ce qui décide de la voie de mon dossier ?",
      meta: "Pilier · 9 min",
    },
    { n: "02", title: "AVDT, c'est quoi ?", meta: "4 min" },
    { n: "03", title: "RTI, c'est quoi ?", meta: "5 min" },
    { n: "04", title: "Un COC, c'est quoi, et en ai-je besoin ?", meta: "4 min" },
    {
      n: "05",
      title: "Pourquoi mon dossier part en RTI alors que la voiture est européenne ?",
      meta: "5 min",
      href: "/blog/rti-avdt/pourquoi-mon-dossier-part-en-rti",
    },
    { n: "06", title: "Combien coûte une RTI et combien de temps ça prend ?", meta: "5 min" },
  ],
};

const ARTICLE = {
  dossier: "rti-avdt",
  slug: "pourquoi-mon-dossier-part-en-rti",
  crumb: "Pourquoi mon dossier part en RTI ?",
  eyebrow: "Dossier 01 · voie d'immatriculation",
  title: "Pourquoi mon dossier part en RTI alors que la voiture est européenne ?",
  lede:
    "Le numéro de réception par type est l'un des quinze champs que la DREAL exige pour une AVDT. Quand il n'est pas imprimé, la voie se ferme avant même l'examen du dossier : pas d'étape COC, un rendez-vous de réception à titre isolé.",
  published: "Publié le 14 octobre 2026",
  reading: "5 min de lecture",
  blocks: [
    { type: "h2", text: "Le champ D.2, c'est quoi ?" },
    {
      type: "p",
      text: "Sur un certificat d'immatriculation harmonisé, le champ D.2 porte le numéro de réception par type du véhicule, souvent libellé e1*2007/46*0123*04. Il signifie qu'un État membre a homologué ce modèle pour toute l'Union. En Allemagne, il figure sur le Teil I sous l'intitulé « Typgenehmigungsnummer » ; en Belgique et aux Pays-Bas, le code D.2 apparaît tel quel.",
    },
    {
      type: "field",
      code: "D.2",
      label: "Numéro de réception par type · Typgenehmigungsnummer",
      example:
        "Exemple de valeur attendue : e1*2007/46*0458*11. Une case vide, un tiret ou « – » : le champ est absent.",
    },
    { type: "h2", text: "Pourquoi l'AVDT se ferme-t-elle ?" },
    {
      type: "p",
      text: "L'attestation de vérification des données techniques repose sur un principe simple : la DREAL ne contrôle pas le véhicule, elle vérifie que les quinze champs harmonisés du certificat correspondent aux plaques. Sans numéro de réception par type, l'administration ne peut rattacher la voiture à aucune homologation européenne. Le dossier ne passe pas l'étape de recevabilité.",
    },
    {
      type: "p",
      text: "Cela ne dépend ni du pays de fabrication, ni de l'état du véhicule. Une Golf allemande au champ D.2 vide part en RTI ; une Mustang immatriculée aux Pays-Bas avec un D.2 rempli reste éligible à l'AVDT.",
    },
    { type: "h2", text: "Que se passe-t-il en RTI directe ?" },
    {
      type: "p",
      text: "Le dossier de réception à titre isolé se dépose auprès de la DREAL, de la DRIEAT en Île-de-France ou de la DEAL outre-mer. Il ne comporte aucune étape de certificat de conformité : la voie COC est réservée aux véhicules dont l'homologation européenne est connue. Comptez un dossier technique, la présentation du véhicule et, selon les cas, des essais complémentaires.",
    },
    { type: "h2", text: "AVDT ou RTI : quelle différence pour moi ?" },
    {
      type: "table",
      head: ["Critère", "AVDT", "RTI directe"],
      rows: [
        ["Condition d'entrée", "15 champs, M1/N1, titre définitif", "Un champ manquant, dont D.2"],
        ["Certificat de conformité", "Non requis", "Non requis, pas d'étape COC"],
        ["Examen du véhicule", "Plaques et données, sans essai", "Dossier technique, essais possibles"],
        ["Coût DREAL", "67,38 € l'attestation", "Variable, souvent plusieurs centaines d'euros"],
        ["Pièce remise", "Attestation AVDT", "Procès-verbal de RTI"],
      ],
    },
  ],
  cta: {
    title: "Votre carte grise a-t-elle un champ D.2 ? Immatis le lit pour vous.",
    text: "Une photo. Dix secondes. La voie, le champ lu et la règle appliquée.",
  },
};

const DOSSIERS = { [RTI.slug]: RTI };
const ARTICLES = { [`${ARTICLE.dossier}/${ARTICLE.slug}`]: ARTICLE };

export function getDossier(slug) {
  return DOSSIERS[slug] ?? null;
}

export function getArticle(dossier, slug) {
  return ARTICLES[`${dossier}/${slug}`] ?? null;
}

export function dossierParams() {
  return Object.keys(DOSSIERS).map((dossier) => ({ dossier }));
}

export function articleParams() {
  return Object.values(ARTICLES).map((article) => ({
    dossier: article.dossier,
    slug: article.slug,
  }));
}
