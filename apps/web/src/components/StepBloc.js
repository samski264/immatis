import ParticleScene from "./ParticleScene";
import styles from "./css/StepBloc.module.css";

// Composant Figma `step_bloc` (49:245) : carte d'étape colorée de 295 de large, scène animée
// pleine largeur en haut, titre + texte en dessous ; la hauteur suit le contenu.
// La scène (`drop`, `scan`, `stamp`, voir lib/stepScenes) reprend le système de particules
// tramées de la bande de paysages, en monochrome : rampe de la couleur du texte vers le fond.
export default function StepBloc({ background, color = "#000", scene, title, children }) {
  return (
    <article className={styles.bloc} style={{ background, color }}>
      <ParticleScene
        className={styles.picture}
        scene={scene}
        ink={color}
        background={background}
      />
      <div className={styles.text}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.body}>{children}</p>
      </div>
    </article>
  );
}
