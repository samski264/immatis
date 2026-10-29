"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./css/Navbar.module.css";

const LINKS = [
  ["Comment ça marche", "#comment-ca-marche"],
  ["Pourquoi avant l'achat", "#avant-achat"],
  ["Réponses", "#reponses"],
];

export default function Navbar({ links = LINKS }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className={styles.bar} style={open ? { zIndex: 5 } : undefined}>
      <Link href="/" className={styles.logo} aria-label="immatis, accueil" onClick={() => setOpen(false)}>
        <Image src="/logo-lockup.svg" alt="" width={188} height={30} priority unoptimized />
      </Link>
      <button
        type="button"
        className={styles.burger}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.glyph} data-open={open ? "" : undefined} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.srOnly}>{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
      </button>
      <nav
        id={menuId}
        className={open ? `${styles.links} ${styles.open}` : styles.links}
        aria-label="Page"
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        {links.map(([label, href]) => (
          <a key={label} className={styles.link} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
