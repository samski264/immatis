import localFont from "next/font/local";

// Polices de la maquette Figma immatis (node 36:111), servies par next/font : préchargées,
// auto-hébergées, avec une police de repli ajustée pour éviter le saut de mise en page.

// Titres : seules les graisses 200 (blocs) et 500 (titre principal) sont utilisées.
export const aquawax = localFont({
  variable: "--font-aquawax",
  display: "swap",
  src: [
    { path: "../fonts/aquawaxfx-extralight.otf", weight: "200", style: "normal" },
    { path: "../fonts/aquawaxfx-medium.otf", weight: "500", style: "normal" },
  ],
});

// Texte courant : police variable dont l'axe de graisse va de 64 à 116 (pas de 100..900).
// Les graisses à utiliser sont exposées par --wght-text et --wght-bold dans globals.css.
export const parabole = localFont({
  variable: "--font-parabole",
  display: "swap",
  weight: "64 116",
  src: "../fonts/parabole-variabletext.woff2",
});
