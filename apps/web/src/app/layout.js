import { aquawax, parabole } from "./fonts";
import "./globals.css";

export const metadata = {
  title: "Immatis — L'ANTS en moins de dix secondes",
  description:
    "Immatis simule l'instruction de votre dossier d'immatriculation à partir de la carte grise étrangère, avant que vous n'achetiez le véhicule.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${aquawax.variable} ${parabole.variable}`}>
      <body>{children}</body>
    </html>
  );
}
