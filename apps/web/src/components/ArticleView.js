import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { DOSSIER } from "@/lib/articles";
import styles from "./css/ArticleView.module.css";

const NAV = [
  ["Comment ça marche", "/#comment-ca-marche"],
  ["Pourquoi avant l'achat", "/#avant-achat"],
  ["Réponses", "/#reponses"],
];

const PRODUCT_LINKS = [
  ["Comment ça marche", "/#comment-ca-marche"],
  ["Pourquoi avant l'achat", "/#avant-achat"],
  ["Pays couverts", "/#documents"],
  ["Documents acceptés", "/#documents"],
  ["Réponses", "/#reponses"],
];

const ANSWER_LINKS = [
  ["Voie : AVDT ou RTI", "/#voie"],
  ["TVA", "/#tva"],
  ["Chevaux fiscaux", "/#chevaux"],
  ["Malus", "/#malus"],
];

const LEGAL = ["Mentions légales", "Confidentialité", "Contact"];

function Rich({ text }) {
  const parts = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let match = pattern.exec(text);
  let key = 0;
  while (match) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const href = match[2].replace(/\/$/, "") || "/";
    parts.push(
      <Link key={key} href={href} className={styles.inline}>
        {match[1]}
      </Link>,
    );
    key += 1;
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function tableClass(block) {
  const count = block.header.length;
  const short = block.rows.every((row) => (row[0] || "").length <= 5);
  if (block.header.at(-1) === "Résultat") return styles.emphasizeLast;
  if (count >= 4) return styles.cols4;
  if (count === 3) return styles.cols3;
  if (short) return styles.colsCode;
  return undefined;
}

function Blocks({ blocks }) {
  return blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === "h2") return <h2 key={key}>{block.text}</h2>;
    if (block.type === "h3") return <h3 key={key}>{block.text}</h3>;
    if (block.type === "p") {
      return (
        <p key={key}>
          <Rich text={block.text} />
        </p>
      );
    }
    if (block.type === "ol" || block.type === "ul") {
      return (
        <ol key={key} className={styles.list}>
          {block.items.map((item, itemIndex) => (
            <li key={item}>
              <span className={styles.marker}>
                {block.type === "ol" ? String(itemIndex + 1).padStart(2, "0") : "—"}
              </span>
              <span>
                <Rich text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    }
    if (block.type === "table") {
      return (
        <div key={key} className={styles.tableWrap}>
          <table className={`${styles.table} ${tableClass(block) || ""}`}>
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th key={cellIndex} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (block.type === "field") {
      return (
        <div key={key} className={styles.field}>
          <p className={styles.fieldLabel}>{block.label}</p>
          <div className={styles.fieldRow}>
            <p className={styles.fieldCode}>{block.code}</p>
            <div>
              <p className={styles.fieldTitle}>{block.title}</p>
              <p className={styles.fieldNote}>{block.note}</p>
            </div>
          </div>
        </div>
      );
    }
    if (block.type === "formula") {
      return (
        <figure key={key} className={styles.formula}>
          <p className={styles.formulaLabel}>{block.label}</p>
          <p className={styles.formulaExpression}>{block.expression}</p>
          <p className={styles.formulaNote}>{block.note}</p>
        </figure>
      );
    }
    if (block.type === "rail") return <DecisionRail key={key} rail={block} />;
    return null;
  });
}

function DecisionRail({ rail }) {
  return (
    <figure className={styles.rail}>
      <div className={styles.railBoard}>
        <span className={styles.lineOk} />
        <span className={styles.lineNo} />
        {rail.steps.map((step, index) => (
          <div key={step.title}>
            <p className={styles.stop} style={{ left: 10 + index * 200 }}>
              <span className={styles.stopTitle}>{step.title}</span>
              <span className={styles.stopField}>{step.field}</span>
            </p>
            <span className={styles.station} style={{ left: 16 + index * 200 }} />
            <span className={styles.drop} style={{ left: 23.5 + index * 200 }} />
            <span className={styles.elseLabel} style={{ left: 34 + index * 200 }}>
              sinon
            </span>
          </div>
        ))}
        <p className={`${styles.terminus} ${styles.terminusOk}`}>
          <strong>{rail.ok.label}</strong>
          <span>{rail.ok.note}</span>
        </p>
        <p className={`${styles.terminus} ${styles.terminusNo}`}>
          <strong>{rail.no.label}</strong>
          <span>{rail.no.note}</span>
        </p>
        <p className={styles.legend}>{rail.legend}</p>
      </div>
    </figure>
  );
}

function Chevron() {
  return (
    <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M4.5 2.5 8 6 4.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10h12M12 5l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

export default function ArticleView({ article }) {
  return (
    <div className={styles.shell}>
      <main className={styles.page}>
        <Navbar links={NAV} />

        <nav className={styles.crumbs} aria-label="Fil d'Ariane">
          {article.crumbs.map((crumb, index) => (
            <span key={crumb.label} className={styles.crumb}>
              {index > 0 ? <Chevron /> : null}
              {crumb.href ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <span aria-current="page">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <header className={styles.header}>
          <p className={styles.eyebrow}>{article.eyebrow}</p>
          <h1>{article.heading}</h1>
          <p className={styles.chapeau}>
            <Rich text={article.chapeau} />
          </p>
          {article.updated ? <p className={styles.updated}>{article.updated}</p> : null}
        </header>

        <div className={styles.corps}>
          <article className={styles.article}>
            <Blocks blocks={article.body} />
            <nav className={styles.suite} aria-label="Pour aller plus loin">
              {article.suite.map((item) => (
                <Link key={item.href} href={item.href} className={styles.suiteLink}>
                  <span>
                    <span className={styles.suiteEyebrow}>{item.eyebrow}</span>
                    <span className={styles.suiteTitle}>{item.title}</span>
                  </span>
                  <Arrow />
                </Link>
              ))}
            </nav>
          </article>

          <aside className={styles.aside}>
            <section className={styles.readingBlock}>
              <p className={styles.eyebrow}>Ce que lit Immatis</p>
              <article className={styles.card}>
                <header className={styles.cardHead}>
                  <p>{article.reading.label}</p>
                  <span className={styles.badge}>
                    <span className={styles.dot} aria-hidden="true" />
                    {article.reading.status}
                  </span>
                </header>
                <div className={styles.cardValue}>
                  <p className={styles.figure}>{article.reading.value}</p>
                  <p>{article.reading.consequence}</p>
                </div>
                <div className={styles.trace}>
                  <div>
                    <p className={styles.traceLabel}>Champ lu</p>
                    <p className={styles.traceValue}>{article.reading.field}</p>
                  </div>
                  <div>
                    <p className={styles.traceLabel}>Règle appliquée</p>
                    <p className={styles.rule}>{article.reading.rule}</p>
                  </div>
                </div>
              </article>
            </section>

            <nav className={styles.dossier} aria-label="Dans ce dossier">
              <p className={styles.eyebrow}>Dans ce dossier</p>
              {DOSSIER.map((group) => (
                <div key={group.silo} className={styles.silo}>
                  <p className={styles.siloName}>{group.silo}</p>
                  <ul>
                    {group.pages.map((page) => {
                      const current = page.href === article.path;
                      return (
                        <li key={page.href}>
                          <Link
                            href={page.href}
                            aria-current={current ? "page" : undefined}
                            className={current ? styles.currentLink : styles.dossierLink}
                          >
                            {page.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>

        <section className={styles.closing}>
          <div className={styles.banner}>
            <div className={styles.bannerText}>
              <h2>{article.cta.title}</h2>
              <p>{article.cta.text}</p>
            </div>
            <a className={styles.deposit} href="/#depot">
              <UploadIcon />
              Déposer la carte grise
            </a>
          </div>
        </section>

        <footer className={styles.footer}>
          <hr className={styles.filet} />
          <div className={styles.columns}>
            <div className={styles.brand}>
              <Image src="/logo-lockup.svg" alt="immatis" width={188} height={30} unoptimized />
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
                <Link key={label} className={styles.footerLink} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
            <nav className={styles.column} aria-label="Réponses">
              <p className={styles.eyebrow}>Réponses</p>
              {ANSWER_LINKS.map(([label, href]) => (
                <Link key={label} className={styles.footerLink} href={href}>
                  {label}
                </Link>
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
    </div>
  );
}
