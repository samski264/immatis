"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import LandscapeStrip from "@/components/LandscapeStrip";
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
  const [view, setView] = useState(undefined);

  useEffect(() => {
    try {
      const payload = loadResult();
      setView(payload ? conformResult(payload) : null);
    } catch {
      setView(null);
    }
  }, []);

  if (view === undefined) return null;

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
            {view ? <ExportButton /> : null}
          </div>
        </nav>

        <div className={styles.intro}>
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
            <div className={styles.verdict}>
              <div className={styles.badgeIcon}>
                <CheckIcon />
              </div>
              <div className={styles.conclusion}>
                <h2 id="verdict-title">{view.verdict.title}</h2>
                <p>{view.verdict.text}</p>
              </div>
            </div>

            <div className={styles.cards}>
              {view.cards.map((card) => (
                <article key={card.label} className={styles.card}>
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

            <section className={styles.fiscal} aria-labelledby="fiscal-title">
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
                  <p className={styles.mono}>{view.total.detail}</p>
                </div>
                <p className={styles.totalAmount}>{view.total.amount}</p>
              </footer>
            </section>
          </section>

          <section className={styles.extracted} aria-labelledby="extracted-title">
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
