import StepParticles from "./StepParticles";
import styles from "./css/StepBloc.module.css";

// Carte d'étape. `tone` : neutral | lime | sky, couleurs du design system.
export default function StepBloc({ tone = "lime", scene, title, children }) {
  return (
    <article className={`${styles.bloc} ${styles[tone]}`}>
      <StepParticles scene={scene} className={styles.picture} />
      <div className={styles.text}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.body}>{children}</p>
      </div>
    </article>
  );
}
