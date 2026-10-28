import Image from "next/image";
import Link from "next/link";
import styles from "./css/Navbar.module.css";

const LINKS = [
  ["Comment ça marche", "#comment-ca-marche"],
  ["Pourquoi avant l'achat", "#avant-achat"],
  ["Réponses", "#reponses"],
];

export default function Navbar({ links = LINKS }) {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.logo} aria-label="immatis, accueil">
        <Image src="/logo-lockup.svg" alt="" width={188} height={30} priority unoptimized />
      </Link>
      <nav className={styles.links} aria-label="Page">
        {links.map(([label, href]) => (
          <a key={label} className={styles.link} href={href}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
