"use client";

import styles from "./page.module.css";

export default function ExportButton() {
  return (
    <button type="button" className={styles.export} onClick={() => window.print()}>
      Exporter le rapport
    </button>
  );
}
