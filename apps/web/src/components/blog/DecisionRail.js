import styles from "@/app/blog/blog.module.css";

const STATIONS = [
  ["Réception CE sur la carte grise", "Champ K"],
  ["Catégorie M1 ou N1", "Champ J"],
  ["Quinze champs imprimés", "A à S.1, aucun vide"],
];

export default function DecisionRail() {
  return (
    <div className={styles.rail}>
      <span className={styles.lineAvdt} />
      <span className={styles.lineRti} />
      {STATIONS.map(([title, field], index) => (
        <span key={title}>
          <span className={`${styles.branch} ${styles[`branch${index + 1}`]}`} />
          <span className={`${styles.otherwise} ${styles[`otherwise${index + 1}`]}`}>sinon</span>
          <span className={`${styles.station} ${styles[`station${index + 1}`]}`} />
          <span className={`${styles.condition} ${styles[`condition${index + 1}`]}`}>
            <strong>{title}</strong>
            <span>{field}</span>
          </span>
        </span>
      ))}
      <span className={`${styles.term} ${styles.termAvdt}`}>
        <strong>AVDT</strong>
        <span>voie allégée</span>
      </span>
      <span className={`${styles.term} ${styles.termRti}`}>
        <strong>RTI</strong>
        <span>à titre isolé</span>
      </span>
      <p className={styles.legend}>
        Les trois stations passées : AVDT. Une seule manquée : le dossier change de ligne.
      </p>
    </div>
  );
}
