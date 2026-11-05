import ResultView from "./ResultView";

export const metadata = {
  title: "Résultat — Immatis",
  description:
    "Verdict simulé à partir de la carte grise : voie d'homologation, TVA, chevaux fiscaux et malus, avec le champ lu et la règle.",
  robots: { index: false, follow: false },
};

export default function ResultPage() {
  return <ResultView />;
}
