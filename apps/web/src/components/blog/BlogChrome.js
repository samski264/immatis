import Image from "next/image";
import Link from "next/link";
import styles from "@/app/blog/blog.module.css";

const PRODUCT = [
  ["Comment ça marche", "/#comment-ca-marche"],
  ["Pourquoi avant l'achat", "/#avant-achat"],
  ["Pays couverts", "/#documents"],
  ["Documents acceptés", "/#documents"],
  ["Blog", "/blog"],
];

const ANSWERS = [
  ["Voie : AVDT ou RTI", "/#voie"],
  ["TVA", "/#tva"],
  ["Chevaux fiscaux", "/#chevaux"],
  ["Malus", "/#malus"],
];

const LEGAL = ["Mentions légales", "Confidentialité", "Contact"];

export function Chevron() {
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

export function Crumb({ items }) {
  return (
    <nav className={styles.crumb} aria-label="Fil d'Ariane">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={item.label}>
            {index > 0 ? <Chevron /> : null}
            {last || !item.href ? (
              <span className={last ? styles.crumbCurrent : undefined}>{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function BlogNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" aria-label="immatis">
        <Image
          className={styles.lockup}
          src="/logo-lockup.svg"
          alt=""
          width={146}
          height={30}
          priority
          unoptimized
        />
      </Link>
      <div className={styles.navRight}>
        <nav className={styles.navLinks} aria-label="Page">
          <Link className={styles.navLink} href="/#comment-ca-marche">
            Comment ça marche
          </Link>
          <Link className={styles.navLink} href="/#avant-achat">
            Pourquoi avant l&apos;achat
          </Link>
          <Link className={styles.navLink} href="/blog" aria-current="page">
            Blog
          </Link>
        </nav>
        <Link className={styles.countries} href="/#documents">
          <span>Pays couverts</span>
          <span>Allemagne · Belgique · Pays-Bas</span>
        </Link>
      </div>
    </header>
  );
}

export function BlogFooter() {
  return (
    <footer className={styles.footer}>
      <hr className={styles.filet} />
      <div className={styles.columns}>
        <div className={styles.brand}>
          <Image
            className={styles.lockup}
            src="/logo-lockup.svg"
            alt="immatis"
            width={146}
            height={30}
            unoptimized
          />
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
          {PRODUCT.map(([label, href]) => (
            <Link key={label} className={styles.footerLink} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <nav className={styles.column} aria-label="Réponses">
          <p className={styles.eyebrow}>Réponses</p>
          {ANSWERS.map(([label, href]) => (
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
  );
}

export function DepositLink() {
  return (
    <Link className={styles.deposit} href="/#depot">
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
      Déposer la carte grise
    </Link>
  );
}
