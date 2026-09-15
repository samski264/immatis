import { GoogleGenAI } from "@google/genai";
import minimal_coc from "@immatis/core/json/minimal_coc.json" with {type: "json"}
import type { CarCertificate } from "@immatis/core/types";
import { cocSchema, conformSchema } from "@immatis/core/schema"
import * as z from "zod";



const client = new GoogleGenAI({});
const prompt = `
Tu es un expert de l'immatriculation en France de véhicules importés.

Les images fournies sont les différentes faces et volets d'UN SEUL document
d'immatriculation étranger (partie I, partie II, verso technique) portant sur UN SEUL
véhicule. Lis-les toutes et fusionne les informations en un seul certificat.

Ta tâche : renseigner le champ "valeur" de chaque code harmonisé européen du JSON de
sortie. Ne modifie aucun "libelle", n'ajoute ni ne retire aucune clé.

Règles d'extraction :
- N'utilise que ce qui est imprimé sur le document. N'invente, ne déduis et ne complète
  jamais une valeur manquante.
- "valeur" = null si le code est absent, illisible ou imprimé vide ("-", "—", "n.v.t.",
  "onbekend").
- Les libellés sont dans la langue du pays émetteur : identifie chaque champ par son CODE
  harmonisé (A, B, Eƒ, F.1, P.2...), jamais par sa traduction.
- Champs numériques (F.1, G, P.1, P.2, S.1, V.7) : nombre brut, sans unité ni séparateur
  de milliers, point comme séparateur décimal ("350,00 kW" -> 350, "1 835 kg" -> 1835).
- Champs date (B, I) : format "YYYY-MM-DD". Les dates sont généralement écrites en
  jour-mois-année ("15-02-2003" -> "2003-02-15") ; interprète-les selon le pays émetteur.
- B = date de première immatriculation du véhicule (première mise en circulation, tous
  pays confondus), et NON la date de première immatriculation dans le pays émetteur.
- I = date de l'immatriculation à laquelle se réfère le certificat, c'est-à-dire la date
  de mise au nom du titulaire actuel.
- C.1 = titulaire du certificat : nom porté en C.1.1, complété si présent par les
  initiales C.1.2. N'utilise jamais C.6 (destinataire de l'export / nouvel acquéreur).
- D.2 peut être éclaté en plusieurs lignes (type, variante, version) : concatène-les
  avec " – ". Si toutes ces lignes sont vides, renvoie null.
- A, E, J, K et V.9 : recopie la chaîne exactement, en majuscules, sans la reformater
  ni la corriger.
- P.3 : recopie le code ou le mot imprimé tel quel ("B", "Benzine", "Diesel"...).
- H : seulement si une période de validité est explicitement portée au code H. Une
  autorisation de circuler ou une date limite d'exportation n'est pas une période de
  validité.
- Si deux images donnent des valeurs différentes pour un même code, retiens celle du
  volet technique (celui qui porte E, J, F.1, P.1...) et ignore l'autre.

Réponds uniquement par le JSON, sans texte ni commentaire autour.
`;

type ScanMimeType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

type certificateScan = {
  file: string | Blob;
  mimeType: ScanMimeType;
};

type upStream = {
  type: "image",
  uri: string,
  mime_type: string
}


let scans: certificateScan[] = [{ file: "./src/kettentkard.jpeg", mimeType: "image/jpeg" }, { file: "./src/kettentkard2.jpeg", mimeType: "image/jpeg" }, { file: "./src/kettentkard3.jpeg", mimeType: "image/jpeg" }]




async function uploadScans(scans: certificateScan[]): Promise<upStream[]> {

  let scanStreamed: upStream[] = await Promise.all(
    scans.map(async (scan) => {

      let uploadFile = await client.files.upload({
        file: scan.file,
        config: { mimeType: scan.mimeType }
      });

      if (uploadFile.uri === undefined || uploadFile.mimeType === undefined) throw new Error('Upload sans uri exploitable');
      
      else return {       //construct object for GoogleGenAI
        type: "image",
        uri: uploadFile.uri,
        mime_type: uploadFile.mimeType
      }
    })
  )

  return scanStreamed
}

async function ocr(scans: certificateScan[]): Promise<CarCertificate> {

  const interaction = await client.interactions.create({
    model: "gemini-3.8-flash",
    input: [
      { type: "text", text: prompt },
      
      ...await uploadScans(scans)

    ],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: z.toJSONSchema(cocSchema)
    },
  });

  if (interaction.output_text === undefined) throw new Error('Erreur google gen AI repsonse')
  return conformSchema(cocSchema.parse(JSON.parse(interaction.output_text)))
}



console.log(await ocr(scans))