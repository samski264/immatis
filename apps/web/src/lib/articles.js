import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public/articles");

const FILES = {
  "/homologation": "homologation/homologation-voiture-importee.md",
  "/homologation/avdt": "homologation/avdt.md",
  "/homologation/rti": "homologation/rti.md",
  "/taxes": "taxes/taxes-voiture-importee.md",
  "/taxes/malus": "taxes/malus.md",
  "/papiers": "papiers/volets-et-radiation.md",
};

export const DOSSIER = [
  {
    silo: "Homologation",
    pages: [
      { href: "/homologation", label: "Voiture importée : AVDT, RTI ou rien" },
      { href: "/homologation/avdt", label: "AVDT : vérification des données techniques" },
      { href: "/homologation/rti", label: "RTI : réception à titre isolé" },
    ],
  },
  {
    silo: "Taxes",
    pages: [
      { href: "/taxes", label: "TVA, malus et carte grise" },
      { href: "/taxes/malus", label: "Malus d'une voiture d'occasion" },
    ],
  },
  {
    silo: "Papiers",
    pages: [{ href: "/papiers", label: "Les volets et la radiation" }],
  },
];

const TVA_TABLE = {
  type: "table",
  header: ["Véhicule et facture", "TVA française"],
  rows: [
    ["Neuf : moins de 6 mois ou moins de 6 000 km", "20 % sur le prix facturé"],
    ["Occasion, facture exonérée de TVA (livraison intracommunautaire)", "Due"],
    ["Occasion, facture avec TVA allemande à 19 %", "Rien"],
    ["Occasion, régime de la marge (§25a)", "Rien"],
  ],
};

const CERTIFICAT_TABLE = {
  type: "table",
  header: ["Certificat", "Voie et taxes"],
  rows: [
    ["Définitif et harmonisé", "Lisibles"],
    ["Provisoire", "Non lisibles"],
    ["Export", "Non lisibles"],
  ],
};

const field = (label, code, title, note) => ({ type: "field", label, code, title, note });

const P2 = field(
  "Rubrique lue sur la carte grise",
  "P.2",
  "Puissance nette maximale (kW)",
  "Seule rubrique lue pour la puissance fiscale.",
);

const FORMULA = {
  type: "formula",
  label: "Puissance fiscale",
  expression: "CV = 1,8 × (P.2/100)² + 3,87 × (P.2/100) + 1,34",
  note: "Arrondi à l'entier. La taxe régionale est CV × tarif de la région, réduite de moitié au-delà de 10 ans.",
};

const RAIL = {
  type: "rail",
  steps: [
    { title: "Rubrique D.2 renseignée", field: "Type, variante, version" },
    { title: "Quinze rubriques renseignées", field: "A à S.1, aucune vide" },
    { title: "Données conformes", field: "au véhicule" },
  ],
  ok: { label: "AVDT", note: "67,38 €" },
  no: { label: "RTI", note: "à titre isolé" },
  legend: "K vide au départ. Les trois stations passées : AVDT. Une seule manquée : RTI.",
};

const CHROME = {
  "/homologation": {
    eyebrow: "Homologation · guide",
    crumbs: [
      { href: "/#reponses", label: "Réponses" },
      { label: "Homologation" },
    ],
    ops: [
      {
        beforeHeading: "Second temps : les quinze rubriques",
        blocks: [
          field(
            "Rubrique lue sur la carte grise",
            "K",
            "Numéro de réception par type",
            "Exemple de valeur : e1*2007/46*0458*11. Une case absente, vide ou illisible est comptée vide.",
          ),
        ],
      },
    ],
    reading: {
      label: "Voie d'immatriculation",
      status: "Concluant",
      value: "AVDT",
      consequence: "Attestation à 67,38 €.",
      field: "K vide · 15 / 15 rubriques renseignées",
      rule: "K vide et les quinze rubriques renseignées : voie AVDT.",
    },
    suite: [
      {
        href: "/homologation/avdt",
        eyebrow: "En détail · AVDT",
        title: "AVDT : la vérification des données techniques, expliquée simplement",
      },
      {
        href: "/homologation/rti",
        eyebrow: "En détail · RTI",
        title: "RTI : quand la carte grise étrangère ne suffit pas",
      },
      {
        href: "/taxes",
        eyebrow: "Dossier suivant · Taxes",
        title: "Voiture importée : TVA, malus et carte grise",
      },
    ],
    cta: {
      title: "Quelle voie pour votre voiture ? Immatis lit la carte grise pour vous.",
      text: "Une photo, un à trois volets. La voie, la rubrique lue et la règle appliquée.",
    },
  },
  "/homologation/avdt": {
    eyebrow: "Homologation · AVDT",
    crumbs: [
      { href: "/#reponses", label: "Réponses" },
      { href: "/homologation", label: "Homologation" },
      { label: "AVDT" },
    ],
    ops: [
      {
        beforeHeading: "Les quinze rubriques",
        blocks: [
          field(
            "Condition lue sur la carte grise",
            "K",
            "Numéro de réception par type",
            "Doit être vide pour l'AVDT. Renseignée, elle règle la voie : aucune démarche d'homologation.",
          ),
        ],
      },
    ],
    reading: {
      label: "Voie d'immatriculation",
      status: "Concluant",
      value: "AVDT",
      consequence: "Attestation à 67,38 €.",
      field: "K vide · 15 / 15 rubriques renseignées",
      rule: "K vide et les quinze rubriques renseignées : voie AVDT.",
    },
    suite: [
      {
        href: "/homologation",
        eyebrow: "Page pilier · Homologation",
        title: "Voiture importée : AVDT, RTI ou rien, ce que la carte grise décide",
      },
      {
        href: "/homologation/rti",
        eyebrow: "En détail · RTI",
        title: "RTI : quand la carte grise étrangère ne suffit pas",
      },
    ],
    cta: {
      title: "La rubrique K est vide ? Immatis lit les quinze autres pour vous.",
      text: "Une photo, un à trois volets. La rubrique lue et la règle appliquée, en dix secondes.",
    },
  },
  "/homologation/rti": {
    eyebrow: "Homologation · RTI",
    crumbs: [
      { href: "/#reponses", label: "Réponses" },
      { href: "/homologation", label: "Homologation" },
      { label: "RTI" },
    ],
    ops: [
      { afterHeading: "Les cas qui conduisent à la RTI", blocks: [RAIL] },
      {
        beforeHeading: "Ce que cette page ne couvre pas",
        blocks: [
          field(
            "Rubrique lue sur la carte grise",
            "D.2",
            "Type, variante, version",
            "Vide, K étant vide : RTI directe, sans étape intermédiaire.",
          ),
        ],
      },
    ],
    reading: {
      label: "Voie d'immatriculation",
      status: "Concluant",
      value: "RTI",
      consequence: "Réception à titre isolé.",
      field: "K vide · D.2 vide",
      rule: "K vide et une des quinze rubriques vide : voie RTI.",
    },
    suite: [
      {
        href: "/homologation",
        eyebrow: "Page pilier · Homologation",
        title: "Voiture importée : AVDT, RTI ou rien, ce que la carte grise décide",
      },
      {
        href: "/homologation/avdt",
        eyebrow: "En détail · AVDT",
        title: "AVDT : la vérification des données techniques, expliquée simplement",
      },
    ],
    cta: {
      title: "Une rubrique manque-t-elle ? Immatis le voit avant l'achat.",
      text: "Une photo, un à trois volets. La rubrique lue et la règle appliquée, en dix secondes.",
    },
  },
  "/taxes": {
    eyebrow: "Taxes · guide",
    crumbs: [
      { href: "/#reponses", label: "Réponses" },
      { label: "Taxes" },
    ],
    ops: [
      { replaceParagraph: "Un véhicule d'occasion", blocks: [TVA_TABLE] },
      { beforeHeading: "Immatis", blocks: [P2, FORMULA] },
    ],
    reading: {
      label: "Coût de la carte grise",
      status: "Concluant",
      value: "428 €",
      consequence: "8 CV × 53,5 € de tarif moyen.",
      field: "P.2 = 110 kW",
      rule: "1,8 × 1,1² + 3,87 × 1,1 + 1,34 = 7,78, arrondi à 8 CV.",
    },
    suite: [
      {
        href: "/taxes/malus",
        eyebrow: "En détail · Malus",
        title: "Malus sur une voiture importée d'occasion : barème, poids, décote",
      },
      {
        href: "/papiers",
        eyebrow: "Dossier suivant · Papiers",
        title: "Carte grise étrangère : les volets et le tampon de radiation",
      },
    ],
    cta: {
      title: "Combien coûtera la carte grise ? Immatis lit B, V.7, G et P.2.",
      text: "Une photo, un à trois volets. La rubrique lue et la règle appliquée, en dix secondes.",
    },
  },
  "/taxes/malus": {
    eyebrow: "Taxes · Malus",
    crumbs: [
      { href: "/#reponses", label: "Réponses" },
      { href: "/taxes", label: "Taxes" },
      { label: "Malus" },
    ],
    ops: [
      {
        beforeHeading: "Le malus poids",
        blocks: [
          field(
            "Rubrique lue sur la carte grise",
            "V.7",
            "CO2 (g/km)",
            "Vide : malus CO2 compté 0 par Immatis. Absent des cartes grises néerlandaises, disponible auprès du registre RDW.",
          ),
        ],
      },
      {
        beforeHeading: "Le plafond",
        blocks: [
          field(
            "Rubrique lue sur la carte grise",
            "G",
            "Masse du véhicule en service (kg)",
            "Vide : malus poids compté 0 par Immatis.",
          ),
        ],
      },
    ],
    reading: {
      label: "Malus",
      status: "Concluant",
      value: "0 €",
      consequence: "Première immatriculation avant 2015.",
      field: "B = 12/03/2014 · V.7 = 142 g/km",
      rule: "Antérieure au 1er janvier 2015 : aucun malus.",
    },
    suite: [
      {
        href: "/taxes",
        eyebrow: "Page pilier · Taxes",
        title: "Voiture importée : TVA, malus et carte grise",
      },
    ],
    cta: {
      title: "Quel malus pour cette voiture ? Immatis lit V.7, G et B.",
      text: "Une photo, un à trois volets. La rubrique lue et la règle appliquée, en dix secondes.",
    },
  },
  "/papiers": {
    eyebrow: "Papiers · guide",
    crumbs: [
      { href: "/#reponses", label: "Réponses" },
      { label: "Papiers" },
    ],
    ops: [
      {
        beforeHeading: "Définitif, provisoire, export",
        blocks: [
          field(
            "Rubrique qui désigne le volet technique",
            "E",
            "Numéro d'identification du véhicule (VIN)",
            "Avec J, F.1 et P.1, il désigne le volet technique.",
          ),
        ],
      },
      { beforeHeading: "La radiation", blocks: [CERTIFICAT_TABLE] },
    ],
    reading: {
      label: "Volets lus",
      status: "Concluant",
      value: "3 / 3",
      consequence: "Lus comme un seul certificat.",
      field: "E, J, F.1, P.1 sur le volet technique",
      rule: "Deux valeurs pour une rubrique : le volet technique fait foi.",
    },
    suite: [
      {
        href: "/taxes",
        eyebrow: "Dossier précédent · Taxes",
        title: "Voiture importée : TVA, malus et carte grise",
      },
    ],
    cta: {
      title: "Un, deux ou trois volets ? Immatis les lit ensemble.",
      text: "Une photo, un à trois volets. La rubrique lue et la règle appliquée, en dix secondes.",
    },
  },
};

function splitFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const found = line.match(/^([A-Za-z]+):\s*(.+)$/);
    if (!found) continue;
    meta[found[1]] = found[2].replace(/^"|"$/g, "");
  }
  return { meta, body: match[2] };
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        if (!/^\|\s*-+/.test(lines[index])) rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", header: rows[0] || [], rows: rows.slice(1) });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    if (line.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("#") &&
      !lines[index].startsWith("|") &&
      !lines[index].startsWith("- ") &&
      !/^\d+\.\s/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "p", text: paragraph.join(" ") });
  }

  return blocks;
}

function isHeading(block, text) {
  return (block.type === "h2" || block.type === "h3") && block.text === text;
}

function compose(blocks, ops) {
  const title = blocks.find((block) => block.type === "h1")?.text ?? "";
  const rest = blocks.filter((block) => block.type !== "h1");
  const lead = rest.findIndex((block) => block.type === "p");
  const chapeau = lead >= 0 ? rest[lead].text : "";
  const body = rest.filter((_, position) => position !== lead);

  for (const op of ops) {
    if (!op.replaceParagraph) continue;
    const position = body.findIndex(
      (block) => block.type === "p" && block.text.startsWith(op.replaceParagraph),
    );
    if (position >= 0) body.splice(position, 1, ...op.blocks);
  }
  for (const op of ops) {
    if (op.beforeHeading) {
      const position = body.findIndex((block) => isHeading(block, op.beforeHeading));
      if (position >= 0) body.splice(position, 0, ...op.blocks);
    }
    if (op.afterHeading) {
      const position = body.findIndex((block) => isHeading(block, op.afterHeading));
      if (position >= 0) body.splice(position + 1, 0, ...op.blocks);
    }
  }

  return { title, chapeau, body };
}

function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return `Mis à jour le ${formatted}`;
}

const cache = new Map();

export function articleParams() {
  return Object.keys(FILES).map((route) => {
    const [silo, ...rest] = route.slice(1).split("/");
    return rest.length ? { silo, rest } : { silo };
  });
}

export function getArticle(silo, rest) {
  const route = `/${[silo, ...(rest ?? [])].filter(Boolean).join("/")}`;
  const file = FILES[route];
  if (!file) return null;
  if (cache.has(route)) return cache.get(route);

  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const { meta, body } = splitFrontmatter(raw);
  const chrome = CHROME[route];
  const composed = compose(parseBlocks(body), chrome.ops);
  const article = {
    path: route,
    title: meta.title || composed.title,
    heading: composed.title,
    description: meta.description || composed.chapeau,
    updated: formatDate(meta.date),
    chapeau: composed.chapeau,
    body: composed.body,
    eyebrow: chrome.eyebrow,
    crumbs: chrome.crumbs,
    reading: chrome.reading,
    suite: chrome.suite,
    cta: chrome.cta,
  };
  cache.set(route, article);
  return article;
}
