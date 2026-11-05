import styles from "./css/SortieCard.module.css";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 16h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function SortieCard({
  id,
  label,
  status,
  tone = "ok",
  value,
  detail,
  verdict,
  reasons = [],
  className,
  style,
}) {
  const toneClass = tone === "attention" ? styles.attention : tone === "estimate" ? styles.estimate : styles.ok;

  return (
    <article id={id} className={[styles.card, toneClass, className].filter(Boolean).join(" ")} style={style}>
      <header className={styles.head}>
        <h3>{label}</h3>
        <span className={styles.badge}>
          <span className={styles.dot} aria-hidden="true" />
          {status}
        </span>
      </header>
      <div className={styles.value}>
        <p className={styles.figure}>{value}</p>
        {detail ? <p>{detail}</p> : null}
      </div>
      {verdict ? <p className={styles.verdict}>{verdict}</p> : null}
      {reasons.length ? (
        <div className={styles.why}>
          <p>Pourquoi</p>
          <ul>
            {reasons.map((reason) => {
              const item = typeof reason === "string" ? { text: reason } : reason;
              return (
                <li key={item.text}>
                  <span className={item.alert ? styles.alert : styles.check} aria-hidden="true">
                    {item.alert ? <AlertIcon /> : <CheckIcon />}
                  </span>
                  <span>{item.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
