"use client";

import { useState } from "react";
import Link from "next/link";
import CardScene from "@/components/CardScene";
import { FILTERS, TONES } from "@/lib/blog";
import styles from "@/app/blog/blog.module.css";

function Card({ card }) {
  const tone = TONES[card.tone];
  const body = (
    <>
      <div className={styles.scene} style={{ background: tone.bg }}>
        <CardScene scene={card.scene} ink={tone.ink} bg={tone.bg} />
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{card.title}</h2>
        <p className={styles.cardMeta}>{card.meta}</p>
      </div>
    </>
  );
  const className = `${styles.card} ${styles[card.tone]}`;
  if (!card.href) {
    return <article className={className}>{body}</article>;
  }
  return (
    <Link className={className} href={card.href}>
      {body}
    </Link>
  );
}

export default function BlogIndex({ cards }) {
  const [filter, setFilter] = useState("tous");
  const shown = filter === "tous" ? cards : cards.filter((card) => card.dossier === filter);

  return (
    <>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Blog</p>
        <h1 className={styles.title}>Vos questions avant d&apos;acheter, répondues champ par champ.</h1>
        <p className={styles.intro}>
          Trois dossiers, un par réponse que l&apos;administration donnera à votre dossier. Chaque
          article part d&apos;un champ du certificat d&apos;immatriculation et finit sur la règle
          appliquée.
        </p>
      </header>
      <div className={styles.filters} role="group" aria-label="Dossiers">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {shown.map((card) => (
          <Card key={card.title} card={card} />
        ))}
      </div>
    </>
  );
}
