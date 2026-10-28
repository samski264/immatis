import { getFiscal, getReception } from "@immatis/core/rules";

export const dynamic = "force-dynamic";

// Certificat synthétique, calé sur l'exemple de l'accueil. Pas de photo, pas d'identité.
const CERTIFICATE = {
  A: "AB-123-CD",
  B: "2021-05-14",
  "C.1": "Exemple",
  "D.1": "VOLKSWAGEN",
  "D.2": "GOLF",
  "D.3": "CL",
  E: "WVWZZZAUZMP000000",
  "F.1": 1390,
  G: 1361,
  H: "4",
  I: "2021-05-14",
  J: "M1",
  K: null,
  "P.1": 1395,
  "P.2": 67,
  "P.3": "GO",
  "S.1": 5,
  "V.7": 128,
  "V.9": null,
};

function asDate(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function GET() {
  const certificate = {
    ...CERTIFICATE,
    B: asDate(CERTIFICATE.B),
    I: asDate(CERTIFICATE.I),
  };

  return Response.json({
    scannedAt: new Date().toISOString(),
    certificate: CERTIFICATE,
    bilan: {
      reception: getReception(certificate),
      fiscal: getFiscal(certificate),
    },
  });
}
