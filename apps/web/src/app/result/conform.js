// Certificat + bilan renvoyés par POST /scans → contenu de /result.
// Les montants affichés sont ceux du bilan. Le certificat ne sert qu’aux champs lus.

const MINIMAL = ["A", "B", "C.1", "D.1", "D.2", "D.3", "E", "F.1", "G", "H", "I", "P.1", "P.2", "P.3", "S.1"];

const EXPLICATIONS = {
  voie: {
    AVDT: {
      detail: "Vérification des données techniques",
      verdict: "La carte grise ne suffit pas : il faut demander une attestation AVDT (67,38 €).",
      reasons: ["Pas de numéro de réception (case K vide)", "Les 15 rubriques exigées sont lues"],
      rule: "Réception CE en K, catégorie M1 ou N1 en J, quinze champs imprimés. Les trois sont vraies : AVDT. Une seule manquée : RTI.",
    },
    RTI: {
      detail: "Réception à titre isolé",
      verdict: "La carte grise ne suffit pas : le véhicule doit passer une réception.",
      reasons: ["Pas de numéro de réception (case K vide)", "Rubrique manquante : P.2 (puissance)"],
      rule: "Réception CE en K, catégorie M1 ou N1 en J, quinze champs imprimés. Une de ces lectures manque : RTI.",
    },
    recue: {
      detail: "Réception par type déjà portée",
      verdict: "Véhicule déjà réceptionné : un certificat de conformité (COC) reste nécessaire.",
      reasons: ["Numéro de réception lu en case K", "COC à demander au constructeur"],
      rule: "Le calcul n’a pas tranché entre AVDT et RTI.",
    },
    inconnue: {
      detail: "Voie non déterminée",
      verdict: "Le numéro de réception n’a pas pu être lu : la voie reste à confirmer.",
      reasons: ["Case K illisible ou hors de la photo", "Reprenez une photo nette de la carte grise"],
      rule: "Le calcul n’a renvoyé aucune voie, et K n’est pas lu.",
    },
  },
  tva: {
    due: {
      detail: "TVA française à payer",
      verdict: "Moins de 6 mois : la TVA est à payer en France, montant non calculé.",
      rule: "Date B lue, écart en mois de calendrier de 6 ou moins : la TVA est due. Au-delà : pas de TVA. Sans date : non calculée.",
    },
    aucune: {
      detail: "Pas de TVA à l’import",
      verdict: "Le véhicule a plus de 6 mois : aucune TVA à payer en France.",
      rule: "Date B lue, écart au-delà de 6 mois : pas de TVA. En deçà : elle est due. Sans date : non calculée.",
    },
    sansDate: {
      detail: "Date de première immatriculation absente",
      verdict: "Sans la date de première immatriculation, la TVA ne peut pas être calculée.",
      reasons: ["Case B vide ou illisible", "Reprenez une photo nette de la carte grise"],
      rule: "Sans la date B, la TVA n’est pas calculée. La station manque : ni due, ni nulle. Si P.2 est lu, seuls les chevaux fiscaux sortent.",
    },
  },
  chevaux: {
    calcules: {
      detail: "Base du tarif régional de la carte grise.",
      verdict: "Base du prix de la carte grise, à 53,50 € par CV en moyenne.",
      rule: "Prix moyen des régions : 53,50 € par CV. Le tarif exact dépend de la région.",
    },
    sansP2: {
      detail: "Puissance nette absente.",
      rule: "P.2 est vide. Les chevaux fiscaux restent vides, et le prix de la carte grise avec eux.",
    },
  },
  malus: {
    sansDate: {
      detail: "Date de première immatriculation absente",
      verdict: "Sans la date de première immatriculation, le malus ne peut pas être calculé.",
      reasons: ["Case B vide ou illisible", "Reprenez une photo nette de la carte grise"],
      rule: "Sans la date B, le malus n’est pas calculé. L’âge et l’année ne se lisent pas, même si V.7 et G sont lus.",
    },
    anciennete: {
      detail: "Véhicule de plus de 15 ans",
      verdict: "Le véhicule a plus de 15 ans : aucun malus à payer.",
      rule: "L’écart depuis B atteint 181 mois : exonéré, avant le test de 2015. Moins de 181 mois et après 2015 : le malus se calcule.",
    },
    avant2015: {
      detail: "Immatriculé avant 2015",
      verdict: "Première immatriculation avant le 1er janvier 2015 : aucun malus à payer.",
      reasons: ["Exonéré même si CO₂ et masse sont lus"],
      rule: "B est le 1er janvier 2015 ou avant : exonéré. Après cette date, et sous 181 mois, le malus se calcule.",
    },
    sansMesure: {
      detail: "Ni CO₂ ni masse lus",
      verdict: "Il faut au moins le CO₂ ou la masse pour calculer le malus.",
      reasons: ["Cases V.7 et G vides"],
      rule: "Les stations d’âge passent, mais V.7 et G sont vides : non calculé. Un seul des deux suffit, l’autre compte alors pour 0.",
    },
    calcule: {
      detail: "Malus CO₂ et masse à payer",
      verdict: "Malus calculé sur le barème de l’année d’immatriculation, décote comprise.",
      reasons: ["Décote d’ancienneté appliquée"],
      rule: "Moins de 181 mois et après 2015. V.7 et G sont lus. Le malus CO₂ suit le barème de la date B : 0 sous le seuil ou sans barème, le plafond au-delà du dernier gramme, sinon le tarif du gramme ou de la bande. La masse, arrondie au kilo, vaut 0 sous le seuil ou sans barème, sinon la somme des tranches. Avant 2022, pas de barème masse. La décote s’applique sur la somme, de 1 à 180 mois. En dessous d’un mois, elle vaut 0. Le montant est arrondi à l’euro.",
    },
    co2Seul: {
      detail: "Estimé sans la masse",
      verdict: "Le malus au poids n’est pas compté : le montant peut être plus élevé.",
      reasons: ["Masse (case G) non lue, comptée pour 0"],
      rule: "Moins de 181 mois et après 2015. G est vide, donc le malus masse vaut 0. Le malus CO₂ suit le barème de la date B : 0 sous le seuil ou si aucun barème ne couvre cette date, le plafond si V.7 le dépasse, sinon le tarif du gramme ou de la bande. Puis la décote d’ancienneté, de 1 à 180 mois. En dessous d’un mois, elle vaut 0.",
    },
    masseSeule: {
      detail: "Le CO₂ absent compte pour zéro.",
      rule: "Moins de 181 mois et après 2015. V.7 est vide, donc le malus CO₂ vaut 0. La masse est arrondie au kilo. Elle vaut 0 s’il n’y a pas de barème à la date B, ou si elle est sous le seuil. Avant 2022, il n’y a pas de barème masse. Sinon chaque tranche ajoute les kilos qu’elle contient, multipliés par leur tarif au kilo. Puis la décote d’ancienneté.",
    },
  },
  carteGrise: {
    calculee: {
      rule: "Taxe régionale moyenne : puissance fiscale × 53,50 €, arrondie au centime.",
    },
    sansCv: {
      rule: "Sans puissance fiscale, la taxe régionale n’est pas calculée.",
    },
  },
};

const dateFormat = new Intl.DateTimeFormat("fr-FR");
const readDateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const readTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function euros(value) {
  const cents = Math.round(value * 100) % 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function quantity(value, unit) {
  if (value == null || value === "") return "non lu";
  const formatted = numberFormat.format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormat.format(date);
}

function monthsSince(value) {
  if (!value) return null;
  const from = new Date(value);
  if (Number.isNaN(from.getTime())) return null;
  const today = new Date();
  return (today.getFullYear() - from.getFullYear()) * 12 + (today.getMonth() - from.getMonth());
}

function exemption(certificate) {
  const months = monthsSince(certificate?.B);
  if (months == null) return null;
  if (months >= 181) return "anciennete";
  if (new Date(certificate.B) <= new Date("2015-01-01")) return "avant2015";
  return null;
}

function isExempt(certificate) {
  return exemption(certificate) != null;
}

function text(certificate, key) {
  const value = certificate?.[key];
  return value == null || value === "" ? "Non lu" : String(value);
}

function formatReadAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Lecture terminée.";
  return `Lecture terminée le ${readDateFormat.format(date)} à ${readTimeFormat.format(date)}`;
}

function stationField(certificate) {
  const filled = MINIMAL.filter((key) => certificate?.[key] != null).length;
  const missing = MINIMAL.filter((key) => certificate?.[key] == null);
  const reception = certificate?.K == null ? "K absent" : "K renseigné";
  const category = certificate?.J == null || certificate.J === "" ? "J absent" : `J = ${certificate.J}`;
  const fields = missing.length
    ? `${filled} / ${MINIMAL.length} · manque ${missing.join(", ")}`
    : `${filled} / ${MINIMAL.length}`;
  return `${reception} · ${category} · ${fields}`;
}

function receptionCard(certificate, reception) {
  const field = stationField(certificate);

  if (reception === "AVDT") {
    return {
      label: "Homologation",
      status: "Attention requise",
      warn: true,
      value: "AVDT",
      ...EXPLICATIONS.voie.AVDT,
      field,
    };
  }

  if (reception === "RTI") {
    return {
      label: "Homologation",
      status: "Attention requise",
      warn: true,
      value: "RTI",
      ...EXPLICATIONS.voie.RTI,
      field,
    };
  }

  if (certificate?.K) {
    return {
      label: "Homologation",
      status: "Concluant",
      value: "Déjà reçue",
      ...EXPLICATIONS.voie.recue,
      field: `K · ${certificate.K}`,
    };
  }

  return {
    label: "Homologation",
    status: "Attention requise",
    warn: true,
    value: "Inconnue",
    ...EXPLICATIONS.voie.inconnue,
    field: "K · non lu",
  };
}

function tvaCard(certificate, fiscal) {
  const date = formatDate(certificate?.B);
  const months = monthsSince(certificate?.B);
  const field = date ? `B · ${date}${months == null ? "" : ` · ${months} mois`}` : "B · non lu";

  if (!certificate?.B || fiscal == null) {
    return {
      label: "TVA",
      status: "Attention requise",
      warn: true,
      value: "Non calculée",
      ...EXPLICATIONS.tva.sansDate,
      field,
    };
  }

  if (fiscal.TVA === "TVA") {
    return {
      label: "TVA",
      status: "Attention requise",
      warn: true,
      value: "Due",
      ...EXPLICATIONS.tva.due,
      reasons: [
        `Première immatriculation (B) : ${date}`,
        `${months} mois écoulés, sous le seuil de 6 mois`,
      ],
      field,
    };
  }

  return {
    label: "TVA",
    status: "Concluant",
    value: "0 €",
    ...EXPLICATIONS.tva.aucune,
    reasons: [
      `Première immatriculation (B) : ${date}`,
      `${months} mois écoulés, plus de 6 mois`,
    ],
    field,
  };
}

function chevauxCard(certificate, fiscal) {
  const chevaux = fiscal?.chevaux ?? null;
  const field = `P.2 · ${quantity(certificate?.["P.2"], "kW")}`;

  if (!chevaux) {
    return {
      label: "Chevaux fiscaux",
      status: "Incomplet",
      warn: true,
      value: "—",
      ...EXPLICATIONS.chevaux.sansP2,
      field,
    };
  }

  return {
    label: "Chevaux fiscaux",
    status: "Estimé",
    tone: "estimate",
    value: `${chevaux.cv} CV`,
    ...EXPLICATIONS.chevaux.calcules,
    detail: null,
    reasons: [
      `Puissance lue (case P.2) : ${quantity(certificate?.["P.2"], "kW")}, soit ${chevaux.cv} CV`,
      { text: "Tarif moyen des régions : le prix exact dépend de la vôtre", alert: true },
    ],
    field,
  };
}

function malusCard(certificate, fiscal) {
  const date = formatDate(certificate?.B);
  const months = monthsSince(certificate?.B);
  const age = date ? `${date}${months == null ? "" : ` · ${months} mois`}` : "non lu";
  const field = `B · ${age} · V.7 · ${quantity(certificate?.["V.7"], "g/km")} · G · ${quantity(certificate?.G, "kg")}`;

  if (!certificate?.B || fiscal == null) {
    return {
      label: "Malus",
      status: "Attention requise",
      warn: true,
      value: "Non calculé",
      ...EXPLICATIONS.malus.sansDate,
      field,
    };
  }

  const motif = exemption(certificate);
  if (motif) {
    const lecture = `Première immatriculation (B) : ${date}`;
    const reasons = motif === "anciennete"
      ? [lecture, `${months} mois écoulés, au-delà de 180`]
      : [lecture, ...EXPLICATIONS.malus.avant2015.reasons];
    return {
      label: "Malus",
      status: "Concluant",
      value: "Exonéré",
      ...EXPLICATIONS.malus[motif],
      reasons,
      field,
    };
  }

  if (typeof fiscal.malus === "number") {
    const co2 = certificate["V.7"] != null;
    const masse = certificate.G != null;
    const partiel = co2 && !masse;
    const explication = partiel
      ? EXPLICATIONS.malus.co2Seul
      : masse && !co2
        ? EXPLICATIONS.malus.masseSeule
        : EXPLICATIONS.malus.calcule;
    const reasons = partiel
      ? [`CO₂ (V.7) : ${quantity(certificate["V.7"], "g/km")}`, ...explication.reasons]
      : explication === EXPLICATIONS.malus.calcule
        ? [`CO₂ : ${quantity(certificate["V.7"], "g/km")} · masse : ${quantity(certificate.G, "kg")}`, ...explication.reasons]
        : explication.reasons;
    return {
      label: "Malus",
      status: partiel ? "Attention requise" : "Concluant",
      warn: partiel,
      value: euros(fiscal.malus),
      ...explication,
      reasons,
      field,
    };
  }

  return {
    label: "Malus",
    status: "Attention requise",
    warn: true,
    value: "Non calculé",
    ...EXPLICATIONS.malus.sansMesure,
    reasons: [`Première immatriculation (B) : ${date}`, ...EXPLICATIONS.malus.sansMesure.reasons],
    field,
  };
}

function verdictOf(certificate, bilan) {
  const fiscal = bilan?.fiscal ?? null;
  const reception = bilan?.reception ?? null;
  const clauses = [];

  if (reception === "AVDT") clauses.push("Voie AVDT");
  else if (reception === "RTI") clauses.push("Voie RTI");
  else if (certificate?.K) clauses.push("Réception déjà portée au certificat");
  else clauses.push("Homologation non déterminée");

  if (!certificate?.B || fiscal == null) {
    clauses.push("TVA et malus non calculés");
  } else {
    clauses.push(fiscal.TVA === "TVA" ? "TVA à régler" : "pas de TVA");
    if (typeof fiscal.malus === "number") {
      clauses.push(fiscal.malus === 0 ? "pas de malus à régler" : `malus ${euros(fiscal.malus)}`);
    } else if (isExempt(certificate)) clauses.push("malus exonéré");
    else clauses.push("malus non calculé");
  }

  const sentence = `${clauses[0]}, ${clauses.slice(1).join(", ")}.`;
  const cv = fiscal?.chevaux?.cv;
  const text =
    cv == null ? `${sentence} Puissance fiscale non calculée.` : `${sentence} Puissance fiscale : ${cv} CV.`;

  const moneyDue = fiscal?.TVA === "TVA" || (typeof fiscal?.malus === "number" && fiscal.malus > 0);
  const malusSettled = typeof fiscal?.malus === "number" || isExempt(certificate);
  let title = "Dossier a priori recevable";
  if (reception === "RTI") title = "Dossier a priori incomplet";
  else if (moneyDue) title = "Montants à prévoir";
  else if (!certificate?.B || fiscal == null || !malusSettled) title = "Instruction incomplète";

  return { title, text };
}

function fiscalRows(certificate, fiscal) {
  const date = formatDate(certificate?.B);
  const months = monthsSince(certificate?.B);
  const dateField = date ? `B · ${date}${months == null ? "" : ` · ${months} mois`}` : "B · non lu";
  const chevaux = fiscal?.chevaux ?? null;

  const tva = !certificate?.B || fiscal == null
    ? { amount: "Non calculée", tone: "muted", rule: EXPLICATIONS.tva.sansDate.rule }
    : fiscal.TVA === "TVA"
      ? { amount: "Due", rule: EXPLICATIONS.tva.due.rule }
      : { amount: "0 €", rule: EXPLICATIONS.tva.aucune.rule };

  let malus;
  const motif = !certificate?.B || fiscal == null ? null : exemption(certificate);
  if (!certificate?.B || fiscal == null) {
    malus = { amount: "Non calculé", tone: "muted", rule: EXPLICATIONS.malus.sansDate.rule };
  } else if (motif) {
    malus = { amount: "Exonéré", rule: EXPLICATIONS.malus[motif].rule };
  } else if (typeof fiscal.malus === "number") {
    const co2 = certificate["V.7"] != null;
    const masse = certificate.G != null;
    const explication = co2 && !masse
      ? EXPLICATIONS.malus.co2Seul
      : masse && !co2
        ? EXPLICATIONS.malus.masseSeule
        : EXPLICATIONS.malus.calcule;
    malus = { amount: euros(fiscal.malus), rule: explication.rule };
  } else {
    malus = { amount: "Non calculé", tone: "muted", rule: EXPLICATIONS.malus.sansMesure.rule };
  }

  return [
    { poste: "TVA", field: dateField, ...tva },
    {
      poste: "Malus",
      field: `V.7 · ${quantity(certificate?.["V.7"], "g/km")} · G · ${quantity(certificate?.G, "kg")}`,
      ...malus,
    },
    chevaux
      ? {
          poste: "Puissance fiscale",
          field: `P.2 · ${quantity(certificate?.["P.2"], "kW")}`,
          rule: EXPLICATIONS.chevaux.calcules.rule,
          amount: `${chevaux.cv} CV`,
        }
      : {
          poste: "Puissance fiscale",
          field: `P.2 · ${quantity(certificate?.["P.2"], "kW")}`,
          rule: EXPLICATIONS.chevaux.sansP2.rule,
          amount: "Non calculée",
          tone: "muted",
        },
    chevaux
      ? {
          poste: "Carte grise",
          field: `${chevaux.cv} CV · tarif moyen`,
          rule: EXPLICATIONS.carteGrise.calculee.rule,
          amount: euros(chevaux.prix),
          tone: "estimate",
        }
      : {
          poste: "Carte grise",
          field: "CV · non lu",
          rule: EXPLICATIONS.carteGrise.sansCv.rule,
          amount: "Non calculée",
          tone: "muted",
        },
  ];
}

function totalOf(certificate, fiscal) {
  const malus = fiscal?.malus;
  const prix = fiscal?.chevaux?.prix;
  const exempt = fiscal != null && malus == null && isExempt(certificate);
  const malusKnown = typeof malus === "number" || exempt;
  const prixKnown = typeof prix === "number";

  const parts = [
    typeof malus === "number" ? `Malus ${euros(malus)}` : exempt ? "Malus exonéré" : "Malus non calculé",
    prixKnown ? `carte grise ${euros(prix)}` : "carte grise non calculée",
  ];
  if (fiscal?.TVA === "TVA") parts.push("TVA due, non chiffrée");

  return {
    detail: parts.join(" · "),
    amount: malusKnown && prixKnown ? euros((typeof malus === "number" ? malus : 0) + prix) : "—",
  };
}

function puissance(certificate, fiscal) {
  const kw = certificate?.["P.2"];
  const cv = fiscal?.chevaux?.cv;
  if (kw == null && cv == null) return "Non lu";
  const parts = [];
  if (kw != null) parts.push(quantity(kw, "kW"));
  if (cv != null) parts.push(`${cv} CV`);
  return parts.join(" · ");
}

function extracted(certificate, fiscal) {
  return [
    {
      title: "Données principales",
      cards: [
        {
          title: "Le véhicule",
          rows: [
            ["Marque", text(certificate, "D.1")],
            ["Dénomination", text(certificate, "D.3")],
            ["Type", text(certificate, "D.2")],
            ["N° de série (VIN)", text(certificate, "E")],
            ["1re mise en circulation", formatDate(certificate?.B) ?? "Non lu"],
            ["Énergie", text(certificate, "P.3")],
            ["Puissance", puissance(certificate, fiscal)],
          ],
        },
        {
          title: "Données techniques",
          rows: [
            ["Catégorie", text(certificate, "J")],
            ["Cylindrée", certificate?.["P.1"] == null ? "Non lu" : quantity(certificate["P.1"], "cm³")],
            ["CO₂", certificate?.["V.7"] == null ? "Non lu" : quantity(certificate["V.7"], "g/km")],
            ["Masse en service", certificate?.G == null ? "Non lu" : quantity(certificate.G, "kg")],
            ["Masse max.", certificate?.["F.1"] == null ? "Non lu" : quantity(certificate["F.1"], "kg")],
            ["Places", certificate?.["S.1"] == null ? "Non lu" : String(certificate["S.1"])],
            ["Classe environnementale", text(certificate, "V.9")],
            ["Réception", text(certificate, "K")],
          ],
        },
      ],
    },
    {
      title: "Données administratives",
      cards: [
        {
          title: "Le titulaire",
          rows: [["Nom", text(certificate, "C.1")]],
        },
        {
          title: "Le certificat",
          rows: [
            ["Immatriculation", text(certificate, "A")],
            ["Date d’immatriculation", formatDate(certificate?.I) ?? "Non lu"],
            ["Validité", text(certificate, "H")],
          ],
        },
      ],
    },
  ];
}

export function conformResult(payload) {
  const certificate = payload?.certificate ?? {};
  const bilan = payload?.bilan ?? {};
  const fiscal = bilan.fiscal ?? null;
  const date = formatDate(certificate.B);

  return {
    readAt: formatReadAt(payload?.scannedAt),
    verdict: verdictOf(certificate, bilan),
    cards: [
      receptionCard(certificate, bilan.reception ?? null),
      tvaCard(certificate, fiscal),
      chevauxCard(certificate, fiscal),
      malusCard(certificate, fiscal),
    ],
    fiscalContext: date ? `1re immatriculation ${date}` : "Date B non lue",
    rows: fiscalRows(certificate, fiscal),
    total: totalOf(certificate, fiscal),
    columns: extracted(certificate, fiscal),
  };
}
