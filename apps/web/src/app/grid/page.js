import ParticleCanvas from "../ParticleCanvas";
import styles from "./page.module.css";

const COLS = 8;
const ROWS = 5;

// Trou 4x2 au centre de la grille (lignes 2-3, colonnes 3-6)
const isHole = (row, col) => (row === 1 || row === 2) && col >= 2 && col <= 5;

export default function Home() {
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isHole(row, col)) continue;
      cells.push(
        <div
          key={`${row}-${col}`}
          className={styles.cell}
          data-landscape=""
          style={{ gridRow: row + 1, gridColumn: col + 1 }}
        />
      );
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.grid}>
        {cells}
        <p className={styles.title}>
          <strong>L&apos;ANTS</strong> en - de dix secondes.
        </p>
      </div>
      <ParticleCanvas className={styles.canvas} />
    </main>
  );
}
