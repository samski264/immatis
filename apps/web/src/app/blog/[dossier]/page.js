import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumb } from "@/components/blog/BlogChrome";
import DecisionRail from "@/components/blog/DecisionRail";
import { dossierParams, getDossier } from "@/lib/blog";
import styles from "../blog.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return dossierParams();
}

export async function generateMetadata({ params }) {
  const { dossier: slug } = await params;
  const dossier = getDossier(slug);
  if (!dossier) return {};
  return { title: dossier.title, description: dossier.intro };
}

function SourceIcon() {
  return (
    <svg className={styles.sourceIcon} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 2.5h6.2L12.5 5.3V13.5h-9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.2 2.7V5.4h2.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default async function DossierPage({ params }) {
  const { dossier: slug } = await params;
  const dossier = getDossier(slug);
  if (!dossier) notFound();

  return (
    <>
      <Crumb items={[{ label: "Blog", href: "/blog" }, { label: dossier.label }]} />
      <header className={styles.articleHeader}>
        <p className={styles.eyebrow}>{dossier.eyebrow}</p>
        <h1 className={styles.title}>{dossier.title}</h1>
        <p className={styles.intro}>{dossier.intro}</p>
      </header>
      <section className={styles.split} aria-labelledby="regle-titre">
        <div className={styles.side}>
          <p className={styles.eyebrow}>{dossier.rule.eyebrow}</p>
          <h2 id="regle-titre" className={styles.heading}>
            {dossier.rule.title}
          </h2>
          <p className={styles.ruleText}>{dossier.rule.text}</p>
        </div>
        <div className={styles.recap}>
          <DecisionRail />
          <div className={styles.sources}>
            <p className={styles.eyebrow}>Sources</p>
            {dossier.sources.map((source) => (
              <p key={source} className={styles.source}>
                <SourceIcon />
                <span>{source}</span>
              </p>
            ))}
          </div>
        </div>
      </section>
      <section className={`${styles.split} ${styles.articles}`} aria-labelledby="articles-titre">
        <div className={styles.side}>
          <p className={styles.eyebrow}>Les articles du dossier</p>
          <h2 id="articles-titre" className={styles.heading}>
            Six questions, du cas général au cas qui bloque.
          </h2>
        </div>
        <div className={styles.list}>
          <hr className={styles.filet} />
          {dossier.articles.map((article) => {
            const body = (
              <>
                <p className={styles.rowNum}>{article.n}</p>
                <p className={styles.rowTitle}>{article.title}</p>
                <p className={styles.rowMeta}>{article.meta}</p>
              </>
            );
            return (
              <div key={article.n}>
                {article.href ? (
                  <Link className={styles.rowLink} href={article.href}>
                    {body}
                  </Link>
                ) : (
                  <div className={styles.row}>{body}</div>
                )}
                <hr className={styles.filet} />
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
