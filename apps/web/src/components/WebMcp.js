"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerTools, text } from "@/lib/webmcp";

export default function WebMcp({ guides }) {
  const router = useRouter();

  useEffect(() => {
    const paths = guides.map((guide) => guide.path);
    return registerTools([
      {
        name: "list_guides",
        description:
          "Liste les guides Immatis sur l'immatriculation en France d'une voiture achetée à l'étranger : homologation (AVDT, RTI), taxes (TVA, malus, carte grise) et papiers (volets, radiation). Chaque guide donne son chemin, son résumé et la règle qu'il applique.",
        inputSchema: { type: "object", properties: {} },
        execute: () => text(JSON.stringify(guides)),
      },
      {
        name: "open_guide",
        description:
          "Ouvre un guide Immatis dans l'onglet de l'utilisateur. Appeler list_guides d'abord pour choisir le chemin.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", enum: paths, description: "Chemin du guide, par exemple /homologation/avdt." },
          },
          required: ["path"],
        },
        execute: ({ path }) => {
          const guide = guides.find((entry) => entry.path === path);
          if (!guide) return text(`Chemin inconnu : ${path}. Chemins valides : ${paths.join(", ")}.`);
          router.push(guide.path);
          return text(`Guide ouvert : ${guide.title}.`);
        },
      },
      {
        name: "open_scan",
        description:
          "Ouvre la page d'accueil d'Immatis sur la zone de dépôt de la carte grise. Les outils scan_carte_grise et scan_example y deviennent disponibles.",
        inputSchema: { type: "object", properties: {} },
        execute: () => {
          router.push("/#depot");
          return text("Zone de dépôt ouverte. Appeler scan_carte_grise pour lire une carte grise.");
        },
      },
    ]);
  }, [guides, router]);

  return null;
}
