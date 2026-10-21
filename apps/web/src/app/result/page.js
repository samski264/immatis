import Image from "next/image";
import Link from "next/link";
import LandscapeStrip from "@/components/LandscapeStrip";
import ExportButton from "./ExportButton";
import styles from "./page.module.css";

const CARDS = [
  {
    label: "Voie d'homologation",
    status: "Concluant",
    value: "AVDT",
    detail: "COC partiel nécessaire.",
    field: "15 / 15 champs harmonisés · J = M1",
    rule: "Document UE harmonisé, définitif, catégorie M1 : voie AVDT.",
  },
  {
    label: "TVA",
    status: "Concluant",
    value: "0 €",
    detail: "",
    field: "B · 14.05.2021 · 64 mois",
    rule: "Mise en circulation au-delà du seuil de 6 mois : pas de TVA.",
  },
  {
    label: "Chevaux fiscaux",
    status: "Estimé",
    value: "5 CV",
    detail: "Base du tarif régional de la carte grise.",
    field: "P.2 · 67 kW · V.7 · 128 g/km",
    rule: "CO₂/45 + (P/40)^1,6, arrondi à l’entier : 5,13 → 5 CV.",
  },
  {
    label: "Malus",
    status: "Concluant",
    value: "0 €",
    detail: "CO₂ et poids, abattements et décote compris.",
    field: "V.7 · 128 g/km · G · 1 361 kg",
    rule: "Barème WLTP 2021 puis décote de 43 %. Détail ci-dessous.",
  },
];

const FISCAL = [
  {
    poste: "Abattement E85",
    field: "P.3 · Essence",
    rule: "Réservé aux véhicules roulant au superéthanol E85.",
    amount: "Non applicable",
    tone: "muted",
  },
  {
    poste: "Abattement 8 places",
    field: "S.1 · 5 places",
    rule: "Réservé aux véhicules d’au moins 8 places détenus par une personne morale.",
    amount: "Non applicable",
    tone: "muted",
  },
  {
    poste: "Malus CO₂",
    field: "V.7 · 128 g/km",
    rule: "128 g/km, sous le seuil de 133 g/km du barème WLTP 2021.",
    amount: "0 €",
  },
  {
    poste: "Malus au poids",
    field: "G · 1 361 kg",
    rule: "Masse sous le seuil du barème.",
    amount: "0 €",
  },
  {
    poste: "Décote d’ancienneté",
    field: "B · 64 mois",
    rule: "Tranche 61 à 72 mois : −43 % sur le montant.",
    amount: "−43 %",
  },
  {
    poste: "Puissance fiscale",
    field: "P.2 · 110 kW",
    rule: "Formule selon la date d’homologation, absente du Teil I : estimation.",
    amount: "8 CV estimés",
    tone: "estimate",
  },
  {
    poste: "Carte grise",
    field: "Région · Île-de-France",
    rule: "Taxe régionale 8 CV × 54,95 € + taxe fixe 11 € + acheminement 2,76 €.",
    amount: "453,36 €",
  },
];

const COLUMNS = [
  {
    title: "Données principales",
    cards: [
      {
        title: "Le véhicule",
        rows: [
          ["Marque", "VOLKSWAGEN"],
          ["Modèle / type", "GOLF VIII 1.5 eTSI"],
          ["N° de série (VIN)", "WVWZZZCDZMW184726"],
          ["1re mise en circulation", "14.05.2021"],
          ["Énergie", "Essence · hybride légère"],
          ["Puissance", "110 kW · 8 CV fiscaux estimés"],
        ],
      },
      {
        title: "Données techniques",
        rows: [
          ["Catégorie CE", "M1"],
          ["Carrosserie", "Berline à hayon"],
          ["Cylindrée", "1 498 cm³"],
          ["CO₂ WLTP", "128 g/km"],
          ["Masse à vide", "1 361 kg"],
        ],
      },
    ],
  },
  {
    title: "Données administratives",
    cards: [
      {
        title: "Le titulaire",
        rows: [
          ["Nom", "MARTIN, ÉLISE"],
          ["Adresse", "Rosenweg 18, 79110 Freiburg"],
          ["Qualité", "Titulaire principal"],
        ],
      },
      {
        title: "Le certificat",
        rows: [
          ["Pays émetteur", "Allemagne (DE)"],
          ["Immatriculation", "FR · EM 428"],
          ["N° de certificat", "ZB II 04291836"],
          ["Date d'émission", "17.06.2024"],
          ["Nombre de titulaires", "2"],
        ],
      },
    ],
  },
];

function CheckIcon() {
  return (
    <svg className={styles.check} viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M22.13 10.33a11.67 11.67 0 1 1-9.13-8c2.26-.36 4.57.07 6.55 1.22M14.8 18.66l-3-3m13-7-10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const metadata = {
  title: "Résultat — Immatis",
  description:
    "Verdict d'instruction simulé : voie d'homologation, TVA, malus et coût de la carte grise.",
};

export default function ResultPage() {
  return (
    <main className={styles.main}>
      <LandscapeStrip className={styles.landscape} />

      <header className={styles.header}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.logoLink} aria-label="immatis, accueil">
            <Image src="/logo.svg" alt="" width={125} height={204} priority unoptimized />
          </Link>
          <div className={styles.actions}>
            <Link href="/" className={styles.navLink}>
              Nouvelle analyse
            </Link>
            <ExportButton />
          </div>
        </nav>

        <div className={styles.intro}>
          <h1>Votre certificat a été analysé.</h1>
          <p>Lecture terminée le 21 septembre 2026 à 16:04</p>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.synthesis} aria-labelledby="verdict-title">
          <div className={styles.verdict}>
            <div className={styles.badgeIcon}>
              <CheckIcon />
            </div>
            <div className={styles.conclusion}>
              <h2 id="verdict-title">Dossier a priori recevable</h2>
              <p>
                Voie AVDT, véhicule non radié, ni TVA ni malus à régler. Seule la puissance
                fiscale reste une estimation.
              </p>
            </div>
          </div>

          <div className={styles.cards}>
            {CARDS.map((card) => (
              <article key={card.label} className={styles.card}>
                <header className={styles.cardHead}>
                  <p>{card.label}</p>
                  <span className={styles.status}>
                    <span className={styles.dot} aria-hidden="true" />
                    {card.status}
                  </span>
                </header>
                <div className={styles.cardValue}>
                  <p className={styles.figure}>{card.value}</p>
                  {card.detail ? <p>{card.detail}</p> : null}
                </div>
                <div className={styles.trace}>
                  <div>
                    <p className={styles.traceLabel}>Champ lu</p>
                    <p className={styles.mono}>{card.field}</p>
                  </div>
                  <div>
                    <p className={styles.traceLabel}>Règle appliquée</p>
                    <p className={styles.rule}>{card.rule}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className={styles.fiscal} aria-labelledby="fiscal-title">
            <header className={styles.fiscalHead}>
              <div>
                <h2 id="fiscal-title">Détail du calcul fiscal</h2>
                <p>
                  Dans l’ordre d’application : abattements, lecture du barème, décote, puis coût
                  de la carte grise.
                </p>
              </div>
              <p className={styles.context}>
                Barème WLTP 2021 · 1re immatriculation 14.05.2021
              </p>
            </header>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Poste</th>
                  <th scope="col">Champ lu</th>
                  <th scope="col">Règle appliquée</th>
                  <th scope="col">Montant</th>
                </tr>
              </thead>
              <tbody>
                {FISCAL.map((row) => (
                  <tr key={row.poste}>
                    <th scope="row">{row.poste}</th>
                    <td className={styles.mono}>{row.field}</td>
                    <td>{row.rule}</td>
                    <td className={row.tone ? styles[row.tone] : undefined}>{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className={styles.total}>
              <div>
                <p>Total estimé</p>
                <p className={styles.mono}>Malus 0 € + carte grise 453,36 €</p>
              </div>
              <p className={styles.totalAmount}>453,36 €</p>
            </footer>
          </section>
        </section>

        <section className={styles.extracted} aria-labelledby="extracted-title">
          <header className={styles.extractedHead}>
            <h2 id="extracted-title">Ce que nous avons lu.</h2>
            <p>Les valeurs extraites restent à comparer au document original.</p>
          </header>
          <div className={styles.columns}>
            {COLUMNS.map((column) => (
              <div key={column.title} className={styles.column}>
                {column.cards.map((card) => (
                  <section key={card.title} className={styles.infoCard}>
                    <h3>{card.title}</h3>
                    <dl>
                      {card.rows.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
