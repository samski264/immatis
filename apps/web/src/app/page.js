import Image from "next/image";
import Scan from "@/components/Scan";
import StepBloc from "@/components/StepBloc";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>

      <Image
        className={styles.logo}
        src="/logo.svg"
        alt="immatis"
        width={125}
        height={204}
        priority
        unoptimized
      />

      <header className={styles.hero}>
        <h1 className={styles.title}>L&apos;ANTS en moins de dix secondes.</h1>
        <p className={styles.lead}>
          Immatis simule l&apos;instruction de votre dossier à partir de la carte grise
          étrangère, avant que vous n&apos;achetiez le véhicule
        </p>
      </header>

      <section className={styles.upload}>
        <Scan />
      </section>

      <section className={styles.bloc}>
        <h2 className={styles.heading}>Comment ça marche ?</h2>
        <p className={styles.text}>
          La carte grise étrangère contient déjà la réponse. L&apos;administration française la
          lira champ par champ pour décider du sort de votre dossier. Immatis fait la même
          lecture, avant que vous n&apos;ayez versé un euro.
        </p>
      </section>

      <section className={styles.steps}>
        <StepBloc background="#e7e7e7" color="#505050" scene="drop" title="1 Déposez la photo">
          La carte grise que le vendeur vous a envoyée suffit. Rien à saisir.
        </StepBloc>
        <StepBloc background="#c8f57a" scene="scan" title="2 Immatis lit le document">
          Les champs harmonisés sont extraits un par un, puis passés dans les règles françaises.
        </StepBloc>
        <StepBloc background="#d9f3ff" scene="stamp" title="3 Vous obtenez le verdict">
          AVDT ou RTI, radiation, TVA, coût de la carte grise. Pour chaque résultat : le champ lu
          et la règle appliquée.
        </StepBloc>
      </section>

      <div className={styles.duo}>
        <section className={styles.bloc}>
          <h2 className={styles.heading}>Après l&apos;acompte, c&apos;est trop tard.</h2>
          <p className={styles.text}>
            Un champ manquant sur le certificat, et le dossier part en RTI : des mois de délai
            et des frais que personne ne vous avait annoncés. Ça se voit sur la photo. Autant le
            voir avant.
          </p>
        </section>
        <section className={styles.bloc}>
          <h2 className={styles.heading}>Ce qu&apos;Immatis n&apos;est pas</h2>
          <p className={styles.text}>
            Pas de compte. Pas d&apos;e-mail. Pas d&apos;abonnement. Pas de mandataire derrière.
            Le résultat s&apos;affiche, il ne se déverrouille pas.
          </p>
        </section>
      </div>
    </main>
  );
}
