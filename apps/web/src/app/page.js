import Image from "next/image";
import Scan from "@/components/Scan";
import Navbar from "@/components/Navbar";
import StepBloc from "@/components/StepBloc";
import DepositButton from "@/components/DepositButton";
import SortieCard from "@/components/SortieCard";
import cardStyles from "@/components/css/SortieCard.module.css";
import styles from "./page.module.css";

const INPUT_ID = "carte-grise";

const ANSWERS = [
  {
    id: "voie",
    label: "Homologation",
    status: "Attention requise",
    tone: "attention",
    value: "AVDT",
    detail: "Vérification des données techniques",
    verdict: "La carte grise ne suffit pas : il faut demander une attestation AVDT (67,38 €).",
    reasons: ["Pas de numéro de réception (case K vide)", "Les 15 rubriques exigées sont lues"],
  },
  {
    id: "tva",
    label: "TVA",
    status: "Concluant",
    tone: "ok",
    value: "0 €",
    verdict: "Pas de TVA à l’import.",
    reasons: ["Première immatriculation (case B) : 14/05/2021", "64 mois écoulés, au-delà du seuil de 6 mois"],
  },
  {
    id: "chevaux",
    label: "Chevaux fiscaux",
    status: "Estimé",
    tone: "estimate",
    value: "5 CV",
    verdict: "Base du prix de la carte grise, à 53,50 € par CV en moyenne.",
    reasons: [
      "Puissance lue (case P.2) : 67 kW, soit 5 CV",
      { text: "Tarif moyen des régions : le prix exact dépend de la vôtre", alert: true },
    ],
  },
  {
    id: "malus",
    label: "Malus",
    status: "Concluant",
    tone: "ok",
    value: "0 €",
    verdict: "Aucun malus à payer.",
    reasons: ["CO₂ (case V.7) : 128 g/km, sous le seuil de 133", "Avant 2022 : pas de taxe au poids"],
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
    "Trois lectures sur la date B : elle est imprimée, l'écart se compte en mois de calendrier, il dépasse six mois. Les trois vraies : pas de TVA. Sous six mois : elle est due. Sans date : non calculée.",
  ],
  [
    "Il manque un champ sur le certificat, et alors ?",
    "Trois lectures : réception CE en K, catégorie M1 ou N1 en J, quinze champs imprimés. Les trois vraies : AVDT. Une seule manque : RTI. Immatis vous le dit avant l'achat, pas après l'acompte.",
  ],
  [
    "Comment le malus est-il calculé ?",
    "Trois lectures : moins de 181 mois, première immatriculation après 2015, CO₂ ou masse imprimé. Les trois vraies : le malus se calcule, barème de l'année B puis décote. L'âge ou l'année manque : exonéré. Ni V.7 ni G : non calculé.",
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
  ["Blog", "/blog"],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: `{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.immatis.com/#website",
      "url": "https://www.immatis.com/",
      "name": "Immatis",
      "description": "Immatis simule l'instruction de votre dossier d'immatriculation à partir de la carte grise étrangère, avant que vous n'achetiez le véhicule.",
      "inLanguage": "fr"
    },
    {
      "@type": "WebPage",
      "@id": "https://www.immatis.com/#webpage",
      "url": "https://www.immatis.com/",
      "name": "Immatis — L'ANTS en moins de dix secondes",
      "description": "Immatis simule l'instruction de votre dossier d'immatriculation à partir de la carte grise étrangère, avant que vous n'achetiez le véhicule.",
      "inLanguage": "fr",
      "isPartOf": { "@id": "https://www.immatis.com/#website" },
      "mainEntity": { "@id": "https://www.immatis.com/#app" }
    },
    {
      "@type": "WebApplication",
      "@id": "https://www.immatis.com/#app",
      "name": "Immatis",
      "url": "https://www.immatis.com/",
      "description": "Immatis simule l'instruction de votre dossier d'immatriculation à partir de la carte grise étrangère, avant que vous n'achetiez le véhicule.",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Web",
      "inLanguage": "fr",
      "isAccessibleForFree": true,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR"
      },
      "featureList": ["AVDT ou RTI", "TVA", "Chevaux fiscaux", "Malus"]
    },
    {
      "@type": "ItemList",
      "@id": "https://www.immatis.com/#reponses",
      "name": "Quatre réponses, toutes lues dans le certificat",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Homologation",
          "description": "Vérification des données techniques. AVDT. La carte grise ne suffit pas : il faut demander une attestation AVDT (67,38 €). Pas de numéro de réception (case K vide). Les 15 rubriques exigées sont lues."
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "TVA",
          "description": "0 €. Pas de TVA à l'import. Première immatriculation (case B) : 14/05/2021. 64 mois écoulés, au-delà du seuil de 6 mois."
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Chevaux fiscaux",
          "description": "5 CV. Base du prix de la carte grise, à 53,50 € par CV en moyenne. Puissance lue (case P.2) : 67 kW, soit 5 CV. Tarif moyen des régions : le prix exact dépend de la vôtre."
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "Malus",
          "description": "0 €. Aucun malus à payer. CO₂ (case V.7) : 128 g/km, sous le seuil de 133. Avant 2022 : pas de taxe au poids."
        }
      ]
    },
    {
      "@type": "ItemList",
      "@id": "https://www.immatis.com/#documents",
      "name": "Documents acceptés",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Allemagne : Zulassungsbescheinigung Teil I et Teil II",
          "description": "Teil I et Teil II lus ensemble"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Belgique : Certificat d'immatriculation",
          "description": "Champs harmonisés UE"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Pays-Bas : Kentekenbewijs",
          "description": "Champs harmonisés UE"
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.immatis.com/#faq",
      "url": "https://www.immatis.com/#faq",
      "inLanguage": "fr",
      "isPartOf": { "@id": "https://www.immatis.com/#webpage" },
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Comment Immatis décide de la TVA ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Trois lectures sur la date B : elle est imprimée, l'écart se compte en mois de calendrier, il dépasse six mois. Les trois vraies : pas de TVA. Sous six mois : elle est due. Sans date : non calculée."
          }
        },
        {
          "@type": "Question",
          "name": "Il manque un champ sur le certificat, et alors ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Trois lectures : réception CE en K, catégorie M1 ou N1 en J, quinze champs imprimés. Les trois vraies : AVDT. Une seule manque : RTI. Immatis vous le dit avant l'achat, pas après l'acompte."
          }
        },
        {
          "@type": "Question",
          "name": "Comment le malus est-il calculé ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Trois lectures : moins de 181 mois, première immatriculation après 2015, CO₂ ou masse imprimé. Les trois vraies : le malus se calcule, barème de l'année B puis décote. L'âge ou l'année manque : exonéré. Ni V.7 ni G : non calculé."
          }
        },
        {
          "@type": "Question",
          "name": "Immatis remplace-t-il l'ANTS ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Non. Immatis simule l'instruction, il ne dépose rien. Le dossier reste à faire sur ants.gouv.fr, mais vous savez à l'avance ce qui en sortira."
          }
        }
      ]
    }
  ]
}`,
        }}
      />

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
        <div className={cardStyles.row}>
          {ANSWERS.map((card) => (
            <SortieCard key={card.id} {...card} />
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
          <ul className={styles.list}>
            {DOCUMENTS.map(([country, document, scope]) => (
              <li key={country}>
                <hr className={styles.filet} />
                <div className={styles.docRow}>
                  <h3 className={styles.rowLabel}>{country}</h3>
                  <p className={styles.rowBody}>{document}</p>
                  <p className={styles.rowMeta}>{scope}</p>
                </div>
              </li>
            ))}
          </ul>
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
          <ul className={styles.list}>
            {QUESTIONS.map(([question, answer]) => (
              <li key={question}>
                <hr className={styles.filet} />
                <div className={styles.faqRow}>
                  <h3 className={styles.rowLabel}>{question}</h3>
                  <p className={styles.rowBody}>{answer}</p>
                </div>
              </li>
            ))}
          </ul>
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
