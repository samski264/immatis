"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { flyTo } from "@/lib/routeFlight";
import { loadResult } from "@/lib/scanResult";
import ExportButton from "./ExportButton";
import { conformResult } from "./conform";
import styles from "./page.module.css";

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

export default function ResultView() {
  const router = useRouter();
  const [view, setView] = useState(undefined);

  const flyHome = (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    flyTo(router, "/");
  };

  // Avant le paint : pas de frame blanche entre le push et la lecture du sessionStorage.
  useLayoutEffect(() => {
    try {
      const payload = loadResult();
      setView(payload ? conformResult(payload) : null);
    } catch {
      setView(null);
    }
  }, []);

  if (view === undefined) return null;

  const cards = view?.cards ?? [];
  const afterCards = 0.5 + cards.length * 0.11;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <nav className={`${styles.nav} ${styles.deposit}`} style={{ animationDelay: "0.04s" }}>
          <Link href="/" className={styles.logoLink} aria-label="immatis, accueil" onClick={flyHome}>
            <Image src="/logo-lockup.svg" alt="" width={188} height={30} priority unoptimized />
          </Link>
          <div className={styles.actions}>
            <Link href="/" className={styles.navLink} onClick={flyHome}>
              Nouvelle analyse
            </Link>
            {view ? <ExportButton /> : null}
          </div>
        </nav>

        <div className={`${styles.intro} ${styles.deposit}`} style={{ animationDelay: "0.18s" }}>
          <h1>{view ? "Votre certificat a été analysé." : "Aucun certificat analysé."}</h1>
          <p>
            {view
              ? view.readAt
              : "Déposez une carte grise depuis l’accueil pour afficher un résultat."}
          </p>
        </div>
      </header>

      {view ? (
        <div className={styles.content}>
          <section className={styles.synthesis} aria-labelledby="verdict-title">
            <div className={`${styles.verdict} ${styles.deposit}`} style={{ animationDelay: "0.34s" }}>
              <div className={styles.badgeIcon}>
                <CheckIcon />
              </div>
              <div className={styles.conclusion}>
                <h2 id="verdict-title">{view.verdict.title}</h2>
                <p>{view.verdict.text}</p>
              </div>
            </div>

            <div className={styles.cards}>
              {view.cards.map((card, index) => (
                <article
                  key={card.label}
                  className={`${styles.card} ${styles.deposit}`}
                  style={{ animationDelay: `${0.5 + index * 0.11}s` }}
                >
                  <header className={styles.cardHead}>
                    <p>{card.label}</p>
                    <span className={card.warn ? `${styles.status} ${styles.statusWarn}` : styles.status}>
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

            <section
              className={`${styles.fiscal} ${styles.deposit}`}
              style={{ animationDelay: `${afterCards + 0.08}s` }}
              aria-labelledby="fiscal-title"
            >
              <header className={styles.fiscalHead}>
                <div>
                  <h2 id="fiscal-title">Détail du calcul fiscal</h2>
                  <p>TVA, malus, puissance fiscale, puis taxe régionale moyenne.</p>
                </div>
                <p className={styles.context}>{view.fiscalContext}</p>
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
                  {view.rows.map((row) => (
                    <tr key={row.poste}>
                      <th scope="row">{row.poste}</th>
                      <td className={styles.mono} data-label="Champ lu">
                        {row.field}
                      </td>
                      <td data-label="Règle appliquée">{row.rule}</td>
                      <td className={row.tone ? styles[row.tone] : undefined} data-label="Montant">
                        {row.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <footer className={styles.total}>
                <div>
                  <p>Total estimé</p>
                  <p className={styles.mono}>{view.total.detail}</p>
                </div>
                <p className={styles.totalAmount}>{view.total.amount}</p>
              </footer>
            </section>
          </section>

          <section
            className={`${styles.extracted} ${styles.deposit}`}
            style={{ animationDelay: `${afterCards + 0.24}s` }}
            aria-labelledby="extracted-title"
          >
            <header className={styles.extractedHead}>
              <h2 id="extracted-title">Ce que nous avons lu.</h2>
              <p>Les valeurs extraites restent à comparer au document original.</p>
            </header>
            <div className={styles.columns}>
              {view.columns.map((column) => (
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
      ) : null}
    </main>
  );
}
