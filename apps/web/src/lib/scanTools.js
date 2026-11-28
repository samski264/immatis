import { fileFromBase64, text } from "./webmcp";

const MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILES = 3;

const reply = (outcome) =>
  outcome.error ? text(`Lecture impossible : ${outcome.error}`) : text(JSON.stringify(outcome.payload));

// `scan`, `example` et `awaitDeposit` résolvent tous en { payload } ou { error }.
export function scanTools({ scan, example, awaitDeposit }) {
  return [
    {
      name: "scan_carte_grise",
      description:
        "Lit une carte grise allemande, belge ou néerlandaise (1 à 3 volets) et simule l'instruction du dossier d'immatriculation en France : voie d'homologation (aucune, AVDT ou RTI), coût de la carte grise, malus. Passer les fichiers en base64. Sans fichier, la page invite l'utilisateur à déposer sa carte grise et l'outil attend ce dépôt. Renvoie le certificat lu et le bilan en JSON ; la page affiche ensuite le résultat.",
      inputSchema: {
        type: "object",
        properties: {
          files: {
            type: "array",
            maxItems: MAX_FILES,
            description: "Volets de la carte grise. Omettre pour laisser l'utilisateur déposer le fichier lui-même.",
            items: {
              type: "object",
              properties: {
                data: {
                  type: "string",
                  contentEncoding: "base64",
                  description: "Contenu du fichier en base64, avec ou sans préfixe data:.",
                },
                mimeType: { type: "string", enum: MIME_TYPES },
                name: { type: "string", description: "Nom du fichier, facultatif." },
              },
              required: ["data", "mimeType"],
            },
          },
        },
      },
      async execute({ files } = {}, options) {
        if (!files?.length) return reply(await awaitDeposit(options?.signal));
        if (files.some((file) => !MIME_TYPES.includes(file.mimeType))) {
          return text(`Format refusé. Formats acceptés : ${MIME_TYPES.join(", ")}.`);
        }
        let decoded;
        try {
          decoded = files.slice(0, MAX_FILES).map(fileFromBase64);
        } catch {
          return text("Fichier illisible : le contenu n'est pas du base64 valide.");
        }
        return reply(await scan(decoded));
      },
    },
    {
      name: "scan_example",
      description:
        "Lance la lecture d'une carte grise d'exemple (Volkswagen Golf immatriculée en Allemagne) pour montrer ce qu'Immatis renvoie, sans fichier de l'utilisateur.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => reply(await example()),
    },
  ];
}
