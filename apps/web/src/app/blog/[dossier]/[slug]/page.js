import { notFound } from "next/navigation";
import { Crumb, DepositLink } from "@/components/blog/BlogChrome";
import { articleParams, getArticle, getDossier } from "@/lib/blog";
import styles from "../../blog.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return articleParams();
}

export async function generateMetadata({ params }) {
  const { dossier, slug } = await params;
  const article = getArticle(dossier, slug);
  if (!article) return {};
  return { title: article.title, description: article.lede };
}

function Field({ code, label, example }) {
  return (
    <aside className={styles.field}>
      <p className={styles.fieldLabel}>Champ lu sur le certificat</p>
      <div className={styles.fieldRow}>
        <p className={styles.fieldCode}>{code}</p>
        <div>
          <p className={styles.fieldName}>{label}</p>
          <p className={styles.fieldExample}>{example}</p>
        </div>
      </div>
    </aside>
  );
}

function Compare({ head, rows }) {
  return (
    <table className={styles.compare}>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              <td key={cell}>{index === 0 ? cell : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ArticlePage({ params }) {
  const { dossier: dossierSlug, slug } = await params;
  const article = getArticle(dossierSlug, slug);
  const dossier = getDossier(dossierSlug);
  if (!article || !dossier) notFound();

  return (
    <>
      <Crumb
        items={[
          { label: "Blog", href: "/blog" },
          { label: dossier.label, href: `/blog/${dossier.slug}` },
          { label: article.crumb },
        ]}
      />
      <header className={styles.articleHeader}>
        <p className={styles.eyebrow}>{article.eyebrow}</p>
        <h1 className={styles.articleTitle}>{article.title}</h1>
        <p className={styles.lede}>{article.lede}</p>
        <p className={styles.meta}>
          <span>{article.published}</span>
          <span>{article.reading}</span>
        </p>
      </header>
      <article className={styles.article}>
        {article.blocks.map((block) => {
          if (block.type === "h2") return <h2 key={block.text} className={styles.h2}>{block.text}</h2>;
          if (block.type === "p") return <p key={block.text} className={styles.prose}>{block.text}</p>;
          if (block.type === "field") return <Field key={block.code} {...block} />;
          if (block.type === "table") return <Compare key="table" head={block.head} rows={block.rows} />;
          return null;
        })}
      </article>
      <section className={styles.closing} aria-labelledby="appel-titre">
        <div className={styles.banner}>
          <div className={styles.bannerText}>
            <h2 id="appel-titre" className={styles.bannerTitle}>
              {article.cta.title}
            </h2>
            <p>{article.cta.text}</p>
          </div>
          <DepositLink />
        </div>
      </section>
    </>
  );
}
