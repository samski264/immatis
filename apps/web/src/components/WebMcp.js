"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const text = (value) => ({ content: [{ type: "text", text: value }] });

export default function WebMcp({ guides }) {
  const router = useRouter();

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const controller = new AbortController();
    const paths = guides.map((guide) => guide.path);
    const tools = [
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
    ];

    for (const tool of tools) {
      Promise.resolve()
        .then(() => context.registerTool(tool, { signal: controller.signal }))
        .catch(() => {});
    }
    return () => controller.abort();
  }, [guides, router]);

  return null;
}
