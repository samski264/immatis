import Image from "next/image";
import Scan from "@/components/Scan";
import Navbar from "@/components/Navbar";
import StepBloc from "@/components/StepBloc";
import DepositButton from "@/components/DepositButton";
import styles from "./page.module.css";

const INPUT_ID = "carte-grise";

const ANSWERS = [
  {
    id: "voie",
    label: "Voie d'homologation",
    status: "Concluant",
    tone: "ok",
    value: "AVDT",
    consequence: "Pas de passage en RTI.",
    field: "K absent · 15 / 15 champs harmonisés",
    rule: "Sans numéro de réception K, tout dépend des champs : tous présents, voie AVDT. Un seul absent, et c'est la RTI.",
  },
  {
    id: "tva",
    label: "TVA",
    status: "Concluant",
    tone: "ok",
    value: "0 €",
    consequence: "Pas de TVA à l'import.",
    field: "B · 14.05.2021 · 64 mois",
    rule: "Mise en circulation au-delà du seuil de 6 mois : pas de TVA.",
  },
  {
    id: "chevaux",
    label: "Chevaux fiscaux",
    status: "Estimé",
    tone: "estimate",
    value: "5 CV",
    consequence: "Base du tarif régional de la carte grise.",
    field: "P.2 · 67 kW",
    rule: "Formule puissance → CV : 4,74, arrondi à 5 CV. Prix moyen des régions 2026 : 53,50 € par CV.",
  },
  {
    id: "malus",
    label: "Malus",
    status: "Concluant",
    tone: "ok",
    value: "0 €",
    consequence: "CO₂ et poids, décote d'ancienneté comprise.",
    field: "V.7 · 128 g/km · G · 1 361 kg",
    rule: "Barème WLTP 2021 : 128 g/km, sous le seuil de 133. Pas de taxe au poids avant 2022.",
  },
];

const DOCUMENTS = [
  ["Allemagne", "Zulassungsbescheinigung Teil I et Teil II", "Teil I et Teil II lus ensemble"],
  ["Belgique", "Certificat d'immatriculation", "Champs harmonisés UE"],
  ["Pays-Bas", "Kentekenbewijs", "Champs harmonisés UE"],
];

const QUESTIONS = [
  [
    "Comment Immatis décide de la TVA ?",
    "Sur la date de première mise en circulation, champ B. Au-delà de six mois, pas de TVA à l'import. En deçà, le véhicule est traité comme neuf et la TVA française est due.",
  ],
  [
    "Il manque un champ sur le certificat, et alors ?",
    "Sans numéro de réception en K, l'AVDT exige tous les champs harmonisés. Un seul absent, D.2 par exemple, et le dossier part en RTI. Immatis vous le dit avant l'achat, pas après l'acompte.",
  ],
  [
    "Comment le malus est-il calculé ?",
    "Malus CO₂ sur V.7 et taxe au poids sur G, au barème de l'année de première immatriculation, puis une décote d'ancienneté de 3 % à 100 % selon l'âge. Avant 2015 ou après quinze ans : exonéré. Un champ absent n'est jamais deviné.",
  ],
  [
    "Immatis remplace-t-il l'ANTS ?",
    "Non. Immatis simule l'instruction, il ne dépose rien. Le dossier reste à faire sur ants.gouv.fr, mais vous savez à l'avance ce qui en sortira.",
  ],
];

const PRODUCT_LINKS = [
  ["Comment ça marche", "#comment-ca-marche"],
  ["Pourquoi avant l'achat", "#avant-achat"],
  ["Pays couverts", "#documents"],
  ["Documents acceptés", "#documents"],
];

const ANSWER_LINKS = [
  ["Voie : AVDT ou RTI", "#voie"],
  ["TVA", "#tva"],
  ["Chevaux fiscaux", "#chevaux"],
  ["Malus", "#malus"],
];

const LEGAL = ["Mentions légales", "Confidentialité", "Contact"];

function Lockup({ className }) {
  return (
    <Image
      className={className}
      src="/logo-lockup.svg"
      alt="immatis"
      width={188}
      height={30}
      priority
      unoptimized
    />
  );
}

function UploadIcon() {
  return (
    <svg className={styles.depositIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 16V4m0 0 4.2 4.2M12 4 7.8 8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className={styles.infoIcon} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className={styles.main}>

      <Navbar />

      <header className={styles.hero}>
        <h1 className={styles.title}>L&apos;ANTS en moins de dix secondes.</h1>
        <p className={styles.lead}>
          Immatis simule l&apos;instruction de votre dossier à partir de la carte grise
          étrangère, avant que vous n&apos;achetiez le véhicule
        </p>
      </header>

      <section id="depot" className={styles.upload}>
        <Scan
          inputId={INPUT_ID}
          formats="Carte grise allemande, belge ou néerlandaise · jusqu'à 3 volets · PDF, JPG ou PNG"
        />
      </section>

      <section id="comment-ca-marche" className={styles.bloc}>
        <h2 className={styles.heading}>Comment ça marche ?</h2>
        <p className={styles.text}>
          La carte grise étrangère contient déjà la réponse. L&apos;administration française la
          lira champ par champ pour décider du sort de votre dossier. Immatis fait la même
          lecture, avant que vous n&apos;ayez versé un euro.
        </p>
      </section>

      <section className={styles.steps}>
        <StepBloc tone="neutral" scene="drop" title="1 Déposez la photo">
          La carte grise que le vendeur vous a envoyée suffit. Rien à saisir.
        </StepBloc>
        <StepBloc tone="lime" scene="scan" title="2 Immatis lit le document">
          Les champs harmonisés sont extraits un par un, puis passés dans les règles françaises.
        </StepBloc>
        <StepBloc tone="sky" scene="stamp" title="3 Vous obtenez le verdict">
          AVDT ou RTI, TVA, chevaux fiscaux, malus. Pour chaque résultat : le champ lu et la règle
          appliquée.
        </StepBloc>
      </section>

      <div id="avant-achat" className={styles.duo}>
        <section className={styles.bloc}>
          <h2 className={styles.heading}>Après l&apos;acompte, c&apos;est trop tard.</h2>
          <p className={styles.text}>
            Un champ manquant sur le certificat, et le dossier part en RTI : des mois de délai
            et des frais que personne ne vous avait annoncés. Ça se voit sur la photo. Autant le
            voir avant.
          </p>
        </section>
        <section className={styles.bloc}>
          <h2 className={styles.heading}>Ce qu&apos;Immatis n&apos;est pas</h2>
          <p className={styles.text}>
            Pas de compte. Pas d&apos;e-mail. Pas d&apos;abonnement. Pas de mandataire derrière.
            Le résultat s&apos;affiche, il ne se déverrouille pas.
          </p>
        </section>
      </div>

      <section id="reponses" className={styles.answers} aria-labelledby="reponses-title">
        <div className={styles.answersHead}>
          <div className={styles.sectionTitle}>
            <p className={styles.eyebrow}>Ce que vous obtenez</p>
            <h2 id="reponses-title" className={styles.heading}>
              Quatre réponses, toutes lues dans le certificat.
            </h2>
          </div>
          <p className={styles.intro}>
            Pas de formulaire : l&apos;entrée, c&apos;est le document. Chaque réponse affiche le
            champ lu et la règle appliquée, pour que vous puissiez la vérifier vous-même.
          </p>
        </div>
        <div className={styles.cards}>
          {ANSWERS.map((card) => (
            <article id={card.id} key={card.id} className={styles.card}>
              <header className={styles.cardHead}>
                <p>{card.label}</p>
                <span className={card.tone === "estimate" ? `${styles.badge} ${styles.estimate}` : styles.badge}>
                  <span className={styles.dot} aria-hidden="true" />
                  {card.status}
                </span>
              </header>
              <div className={card.tone === "estimate" ? `${styles.cardValue} ${styles.estimate}` : styles.cardValue}>
                <p className={styles.figure}>{card.value}</p>
                <p>{card.consequence}</p>
              </div>
              <div className={styles.trace}>
                <div>
                  <p className={styles.traceLabel}>Champ lu</p>
                  <p className={styles.traceValue}>{card.field}</p>
                </div>
                <div>
                  <p className={styles.traceLabel}>Règle appliquée</p>
                  <p className={styles.rule}>{card.rule}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="documents" className={styles.split} aria-labelledby="documents-title">
        <div className={styles.sectionTitle}>
          <p className={styles.eyebrow}>Documents acceptés</p>
          <h2 id="documents-title" className={styles.heading}>
            Trois pays, un seul document.
          </h2>
          <p className={styles.intro}>
            Le certificat d&apos;immatriculation suffit. Déposez toutes ses faces et volets :
            Immatis les fusionne en un seul certificat, champ par champ.
          </p>
        </div>
        <div className={styles.rows}>
          {DOCUMENTS.map(([country, document, scope]) => (
            <div key={country}>
              <hr className={styles.filet} />
              <div className={styles.docRow}>
                <p className={styles.rowLabel}>{country}</p>
                <p className={styles.rowBody}>{document}</p>
                <p className={styles.rowMeta}>{scope}</p>
              </div>
            </div>
          ))}
          <hr className={styles.filet} />
          <p className={styles.note}>
            <InfoIcon />
            Une valeur absente, illisible ou imprimée vide n&apos;est jamais déduite : le champ
            reste vide et la règle le dit.
          </p>
        </div>
      </section>

      <section id="faq" className={styles.split} aria-labelledby="faq-title">
        <div className={styles.sectionTitle}>
          <p className={styles.eyebrow}>Questions fréquentes</p>
          <h2 id="faq-title" className={styles.heading}>
            Ce qu&apos;on nous demande avant de déposer.
          </h2>
        </div>
        <div className={styles.rows}>
          {QUESTIONS.map(([question, answer]) => (
            <div key={question}>
              <hr className={styles.filet} />
              <div className={styles.faqRow}>
                <h3 className={styles.rowLabel}>{question}</h3>
                <p className={styles.rowBody}>{answer}</p>
              </div>
            </div>
          ))}
          <hr className={styles.filet} />
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <h2 id="closing-title" className={styles.bannerTitle}>
              Lisez la carte grise avant d&apos;acheter la voiture.
            </h2>
            <p>Une photo. Dix secondes. Aucun compte à créer.</p>
          </div>
          <DepositButton className={styles.deposit} inputId={INPUT_ID}>
            <UploadIcon />
            Déposer la carte grise
          </DepositButton>
        </div>
      </section>

      <footer className={styles.footer}>
        <hr className={styles.filet} />
        <div className={styles.columns}>
          <div className={styles.brand}>
            <Lockup className={styles.lockup} />
            <p>
              Lisez la carte grise avant d&apos;acheter la voiture. Immatis simule
              l&apos;instruction de votre dossier à partir du certificat étranger, et rien
              d&apos;autre.
            </p>
            <p className={styles.independence}>
              Outil indépendant, sans lien avec l&apos;ANTS ni l&apos;administration française.
            </p>
          </div>
          <nav className={styles.column} aria-label="Produit">
            <p className={styles.eyebrow}>Produit</p>
            {PRODUCT_LINKS.map(([label, href]) => (
              <a key={label} className={styles.footerLink} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <nav className={styles.column} aria-label="Réponses">
            <p className={styles.eyebrow}>Réponses</p>
            {ANSWER_LINKS.map(([label, href]) => (
              <a key={label} className={styles.footerLink} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <div className={styles.column}>
            <p className={styles.eyebrow}>Légal</p>
            {LEGAL.map((label) => (
              <p key={label} className={styles.footerLink}>
                {label}
              </p>
            ))}
          </div>
        </div>
        <hr className={styles.filet} />
        <div className={styles.bottom}>
          <p>© 2026 Immatis</p>
          <p>Pas de compte. Pas d&apos;e-mail. Pas d&apos;abonnement.</p>
          <p>Français</p>
        </div>
      </footer>
    </main>
  );
}
