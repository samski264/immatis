// Certificat + bilan renvoyés par POST /scans → contenu de /result.
// Les montants affichés sont ceux du bilan. Le certificat ne sert qu’aux champs lus.

const MINIMAL = ["A", "B", "C.1", "D.1", "D.2", "D.3", "E", "F.1", "G", "H", "I", "P.1", "P.2", "P.3", "S.1"];

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

function isExempt(certificate) {
  const months = monthsSince(certificate?.B);
  if (months == null) return false;
  if (months >= 181) return true;
  return new Date(certificate.B) <= new Date("2015-01-01");
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

function receptionCard(certificate, reception) {
  const filled = MINIMAL.filter((key) => certificate?.[key] != null).length;
  const missing = MINIMAL.filter((key) => certificate?.[key] == null);

  if (reception === "AVDT") {
    return {
      label: "Voie d’homologation",
      status: "Concluant",
      value: "AVDT",
      detail: missing.length ? "Le calcul a retenu la voie AVDT." : "Champs minimaux présents, K absent.",
      field: missing.length
        ? `${filled} / ${MINIMAL.length} champs minimaux · manque ${missing.join(", ")}`
        : `${filled} / ${MINIMAL.length} champs minimaux · J · ${text(certificate, "J")}`,
      rule: "K absent et champs minimaux renseignés : voie AVDT.",
    };
  }

  if (reception === "RTI") {
    return {
      label: "Voie d’homologation",
      status: "Concluant",
      value: "RTI",
      detail: "Au moins un champ minimal manque.",
      field: `${filled} / ${MINIMAL.length} champs minimaux · manque ${missing.join(", ")}`,
      rule: "K absent et champ minimal manquant : voie RTI.",
    };
  }

  if (certificate?.K) {
    return {
      label: "Voie d’homologation",
      status: "Concluant",
      value: "Reçue",
      detail: "Numéro de réception déjà porté au certificat.",
      field: `K · ${certificate.K}`,
      rule: "K renseigné : pas de voie AVDT ni RTI.",
    };
  }

  return {
    label: "Voie d’homologation",
    status: "Incomplet",
    warn: true,
    value: "—",
    detail: "La voie n’a pas pu être déterminée.",
    field: "K · non lu",
    rule: "Sans K et sans le reste du certificat, la voie reste indéterminée.",
  };
}

function tvaCard(certificate, fiscal) {
  const date = formatDate(certificate?.B);
  const months = monthsSince(certificate?.B);
  const field = date ? `B · ${date}${months == null ? "" : ` · ${months} mois`}` : "B · non lu";

  if (!certificate?.B || fiscal == null) {
    return {
      label: "TVA",
      status: "Incomplet",
      warn: true,
      value: "—",
      detail: "Date de première immatriculation absente.",
      field,
      rule: "Sans la date B, la TVA n’est pas calculée.",
    };
  }

  if (fiscal.TVA === "TVA") {
    return {
      label: "TVA",
      status: "Concluant",
      value: "TVA",
      detail: "Due. Le calcul ne renvoie pas le montant.",
      field,
      rule: "Première immatriculation depuis 6 mois ou moins : TVA due.",
    };
  }

  return {
    label: "TVA",
    status: "Concluant",
    value: "0 €",
    detail: "",
    field,
    rule: "Mise en circulation au-delà de 6 mois : pas de TVA.",
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
      detail: "Puissance nette absente.",
      field,
      rule: "Sans P.2, les chevaux fiscaux ne sont pas calculés.",
    };
  }

  return {
    label: "Chevaux fiscaux",
    status: "Concluant",
    value: `${chevaux.cv} CV`,
    detail: "Base du tarif régional de la carte grise.",
    field,
    rule: "Formule CIBS L421-16 appliquée à P.2, arrondie à l’entier.",
  };
}

function malusCard(certificate, fiscal) {
  const field = `V.7 · ${quantity(certificate?.["V.7"], "g/km")} · G · ${quantity(certificate?.G, "kg")}`;

  if (!certificate?.B || fiscal == null) {
    return {
      label: "Malus",
      status: "Incomplet",
      warn: true,
      value: "—",
      detail: "Date de première immatriculation absente.",
      field,
      rule: "Sans la date B, le malus n’est pas calculé.",
    };
  }

  if (typeof fiscal.malus === "number") {
    return {
      label: "Malus",
      status: "Concluant",
      value: euros(fiscal.malus),
      detail: "CO₂ et masse, décote d’ancienneté comprise.",
      field,
      rule: "V.7 et G au barème de la date B, puis décote d’ancienneté.",
    };
  }

  if (isExempt(certificate)) {
    return {
      label: "Malus",
      status: "Concluant",
      value: "0 €",
      detail: "Véhicule exonéré.",
      field,
      rule: "Plus de 180 mois, ou première immatriculation avant le 1er janvier 2015.",
    };
  }

  return {
    label: "Malus",
    status: "Incomplet",
    warn: true,
    value: "—",
    detail: "CO₂ et masse absents.",
    field,
    rule: "Sans V.7 et sans G, le malus n’est pas calculé.",
  };
}

function verdictOf(certificate, bilan) {
  const fiscal = bilan?.fiscal ?? null;
  const reception = bilan?.reception ?? null;
  const clauses = [];

  if (reception === "AVDT") clauses.push("Voie AVDT");
  else if (reception === "RTI") clauses.push("Voie RTI");
  else if (certificate?.K) clauses.push("Réception déjà portée au certificat");
  else clauses.push("Voie d’homologation non déterminée");

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
  const rate = chevaux?.cv ? chevaux.prix / chevaux.cv : null;

  const tva = !certificate?.B || fiscal == null
    ? { amount: "Non calculée", tone: "muted", rule: "Sans la date B, la TVA n’est pas calculée." }
    : fiscal.TVA === "TVA"
      ? { amount: "Due", rule: "Première immatriculation depuis 6 mois ou moins." }
      : { amount: "0 €", rule: "Mise en circulation au-delà de 6 mois : pas de TVA." };

  let malus;
  if (!certificate?.B || fiscal == null) {
    malus = { amount: "Non calculé", tone: "muted", rule: "Sans la date B, le malus n’est pas calculé." };
  } else if (typeof fiscal.malus === "number") {
    malus = {
      amount: euros(fiscal.malus),
      rule: "CO₂ (V.7) et masse (G) au barème de la date B, décote comprise.",
    };
  } else if (isExempt(certificate)) {
    malus = {
      amount: "Exonéré",
      rule: "Plus de 180 mois, ou première immatriculation avant le 1er janvier 2015.",
    };
  } else {
    malus = { amount: "Non calculé", tone: "muted", rule: "Sans V.7 et sans G, le malus n’est pas calculé." };
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
          rule: "Formule CIBS L421-16 appliquée à P.2, arrondie à l’entier.",
          amount: `${chevaux.cv} CV`,
        }
      : {
          poste: "Puissance fiscale",
          field: `P.2 · ${quantity(certificate?.["P.2"], "kW")}`,
          rule: "Sans P.2, les chevaux fiscaux ne sont pas calculés.",
          amount: "Non calculée",
          tone: "muted",
        },
    chevaux
      ? {
          poste: "Carte grise",
          field: `${chevaux.cv} CV · tarif moyen`,
          rule: rate == null
            ? "Taxe régionale moyenne renvoyée par le calcul."
            : `${chevaux.cv} CV × ${euros(rate)}, moyenne des tarifs régionaux.`,
          amount: euros(chevaux.prix),
          tone: "estimate",
        }
      : {
          poste: "Carte grise",
          field: "CV · non lu",
          rule: "Sans puissance fiscale, la taxe régionale n’est pas calculée.",
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
