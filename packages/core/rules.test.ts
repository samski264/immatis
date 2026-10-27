import { afterEach, describe, expect, it, vi } from "vitest";
import { getFiscal, getReception } from "./rules.ts";
import type { CarCertificate } from "./types.ts";

// Midi UTC : le jour calendaire reste stable de UTC−12 à UTC+11,
// et toISOString() (clé des barèmes) retombe sur ce même jour.
const noon = (day: string) => new Date(`${day}T12:00:00.000Z`);

function freeze(day: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(noon(day));
}

afterEach(() => {
  vi.useRealTimers();
});

const champsExiges = [
  "A",
  "B",
  "C.1",
  "D.1",
  "D.2",
  "D.3",
  "E",
  "F.1",
  "G",
  "H",
  "I",
  "P.1",
  "P.2",
  "P.3",
  "S.1",
] as const satisfies readonly (keyof CarCertificate)[];

function certificate(overrides: Partial<CarCertificate> = {}): CarCertificate {
  return {
    A: "AB-123-CD",
    B: noon("2026-06-15"),
    "C.1": "MARTIN",
    "D.1": "RENAULT",
    "D.2": "RJA",
    "D.3": "CLIO",
    E: "VF1RJA00012345678",
    "F.1": 1620,
    G: 1200,
    H: "2026-2036",
    I: noon("2026-06-15"),
    J: "M1",
    K: null,
    "P.1": 1332,
    "P.2": 90,
    "P.3": "ES",
    "S.1": 5,
    "V.7": 110,
    "V.9": "EURO6",
    ...overrides,
  };
}

function fiscalOn(today: string, overrides: Partial<CarCertificate> = {}) {
  freeze(today);
  return getFiscal(
    certificate({
      B: noon(today),
      G: null,
      "V.7": null,
      "P.2": null,
      ...overrides,
    }),
  );
}

describe("getReception", () => {
  it("classe en AVDT un dossier complet sans numéro de réception", () => {
    expect(getReception(certificate())).toBe("AVDT");
  });

  it("ignore J, V.7 et V.9 pour distinguer AVDT et RTI", () => {
    expect(
      getReception(certificate({ J: null, "V.7": null, "V.9": null })),
    ).toBe("AVDT");
  });

  it("traite 0 comme une valeur renseignée", () => {
    expect(
      getReception(
        certificate({ "F.1": 0, G: 0, "P.1": 0, "P.2": 0, "S.1": 0 }),
      ),
    ).toBe("AVDT");
  });

  it("traite une chaîne vide comme une valeur renseignée", () => {
    expect(getReception(certificate({ A: "" }))).toBe("AVDT");
  });

  it("ne demande rien à la DREAL quand K est renseigné", () => {
    expect(getReception(certificate({ K: "e2*2007/46*0000*00" }))).toBeNull();
  });

  it("ne demande rien à la DREAL même si le reste du dossier est vide", () => {
    const vide = Object.fromEntries(
      Object.keys(certificate()).map((cle) => [cle, null]),
    ) as CarCertificate;

    expect(getReception({ ...vide, K: "e2*2007/46*0000*00" })).toBeNull();
  });

  it.each(champsExiges)("classe en RTI quand %s est absent", (champ) => {
    expect(getReception(certificate({ [champ]: null }))).toBe("RTI");
  });

  it("classe en RTI dès qu'un champ exigé manque, même si d'autres manquent aussi", () => {
    expect(getReception(certificate({ A: null, E: null, G: null }))).toBe("RTI");
  });
});

describe("getFiscal", () => {
  describe("sans date de première immatriculation", () => {
    it("retourne null sans date ni puissance", () => {
      expect(getFiscal(certificate({ B: null, "P.2": null }))).toBeNull();
    });

    it("ne retient que les chevaux fiscaux", () => {
      expect(getFiscal(certificate({ B: null, "P.2": 100 }))).toEqual({
        malus: null,
        TVA: null,
        chevaux: { cv: 7, prix: 374.5 },
      });
    });
  });

  describe("chevaux fiscaux", () => {
    it.each([
      { pm: 0, cv: 1, prix: 53.5 },
      { pm: 100, cv: 7, prix: 374.5 },
      { pm: 110, cv: 8, prix: 428 },
    ])("P.2 = $pm kW donne $cv CV et $prix €", ({ pm, cv, prix }) => {
      expect(getFiscal(certificate({ B: null, "P.2": pm }))).toEqual({
        malus: null,
        TVA: null,
        chevaux: { cv, prix },
      });
    });

    it("laisse les chevaux vides sans P.2", () => {
      expect(fiscalOn("2026-06-15", { "V.7": 108 })).toEqual({
        malus: 50,
        TVA: "TVA",
        chevaux: null,
      });
    });
  });

  describe("TVA", () => {
    it.each([
      { today: "2026-10-15", from: "2026-10-15", TVA: "TVA" },
      { today: "2026-10-15", from: "2026-04-15", TVA: "TVA" },
      { today: "2026-10-15", from: "2026-03-15", TVA: null },
      { today: "2026-10-15", from: "2026-11-15", TVA: "TVA" },
    ])(
      "du $from au $today : TVA = $TVA",
      ({ today, from, TVA }) => {
        expect(fiscalOn(today, { B: noon(from) })).toEqual({
          malus: null,
          TVA,
          chevaux: null,
        });
      },
    );
  });

  describe("exonération de malus", () => {
    it("exonère une première immatriculation au plus tard le 1er janvier 2015", () => {
      expect(
        fiscalOn("2015-06-15", {
          B: new Date("2015-01-01"),
          "V.7": 140,
        }),
      ).toEqual({
        malus: null,
        TVA: "TVA",
        chevaux: null,
      });

      expect(
        fiscalOn("2014-12-15", {
          B: noon("2014-06-15"),
          "V.7": 140,
        }),
      ).toEqual({
        malus: null,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("taxe dès le 2 janvier 2015", () => {
      expect(fiscalOn("2015-01-02", { "V.7": 140 })).toEqual({
        malus: 250,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("exonère à partir de 181 mois", () => {
      expect(
        fiscalOn("2030-09-15", {
          B: noon("2015-08-15"),
          "V.7": 140,
        }),
      ).toEqual({
        malus: null,
        TVA: null,
        chevaux: null,
      });
    });

    it("applique encore le malus à 180 mois, décoté de 94 %", () => {
      expect(
        fiscalOn("2030-08-15", {
          B: noon("2015-08-15"),
          "V.7": 140,
        }),
      ).toEqual({
        malus: 15,
        TVA: null,
        chevaux: null,
      });
    });
  });

  describe("malus CO2", () => {
    it.each([
      { g: 107, malus: 0 },
      { g: 108, malus: 50 },
      { g: 120, malus: 310 },
      { g: 191, malus: 79911 },
      { g: 192, malus: 80000 },
      { g: 108.5, malus: 0 },
    ])("barème 2026 : $g g/km → $malus €", ({ g, malus }) => {
      expect(fiscalOn("2026-06-15", { "V.7": g })).toEqual({
        malus,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it.each([
      { g: 130, malus: 0 },
      { g: 131, malus: 150 },
      { g: 135, malus: 150 },
      { g: 136, malus: 250 },
      { g: 200, malus: 6500 },
      { g: 201, malus: 8000 },
    ])("barème par tranches 2016 : $g g/km → $malus €", ({ g, malus }) => {
      expect(fiscalOn("2016-06-15", { "V.7": g })).toEqual({
        malus,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("change de barème au 1er janvier 2026", () => {
      expect(fiscalOn("2025-12-31", { "V.7": 108 })).toEqual({
        malus: 0,
        TVA: "TVA",
        chevaux: null,
      });
      expect(fiscalOn("2026-01-01", { "V.7": 108 })).toEqual({
        malus: 50,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("vaut 0 quand aucun barème ne couvre la date", () => {
      expect(fiscalOn("2028-06-15", { "V.7": 150 })).toEqual({
        malus: 0,
        TVA: "TVA",
        chevaux: null,
      });
    });
  });

  describe("malus masse", () => {
    it("démarre à 1 500 kg en 2026", () => {
      expect(fiscalOn("2026-06-15", { G: 1499 })).toEqual({
        malus: 0,
        TVA: "TVA",
        chevaux: null,
      });
      expect(fiscalOn("2026-06-15", { G: 1500 })).toEqual({
        malus: 10,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("arrondit les kilogrammes à l'unité", () => {
      expect(fiscalOn("2022-06-15", { G: 1799.6 })).toEqual({
        malus: 10,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("prolonge la dernière tranche sans plafond", () => {
      expect(fiscalOn("2022-06-15", { G: 2000 })).toEqual({
        malus: 2010,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("change de barème au 1er janvier 2026", () => {
      expect(fiscalOn("2025-12-31", { G: 1600 })).toEqual({
        malus: 10,
        TVA: "TVA",
        chevaux: null,
      });
      expect(fiscalOn("2026-01-01", { G: 1600 })).toEqual({
        malus: 1010,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("vaut 0 avant l'existence de la taxe", () => {
      expect(fiscalOn("2021-06-15", { G: 2200 })).toEqual({
        malus: 0,
        TVA: "TVA",
        chevaux: null,
      });
    });
  });

  describe("décote et cumul", () => {
    it("laisse le malus vide quand CO2 et masse sont absents", () => {
      expect(fiscalOn("2026-06-15")).toEqual({
        malus: null,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("retourne 0 quand les deux assiettes sont sous leur seuil", () => {
      expect(fiscalOn("2026-06-15", { "V.7": 107, G: 1499 })).toEqual({
        malus: 0,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it.each([
      { today: "2026-10-15", from: "2026-10-15", g: 108, malus: 50, TVA: "TVA" },
      { today: "2026-10-15", from: "2026-09-15", g: 108, malus: 49, TVA: "TVA" },
      { today: "2026-10-15", from: "2026-07-15", g: 108, malus: 49, TVA: "TVA" },
      { today: "2026-10-15", from: "2026-06-15", g: 108, malus: 47, TVA: "TVA" },
      { today: "2026-06-15", from: "2025-03-15", g: 113, malus: 42, TVA: null },
    ] as const)(
      "du $from au $today, $g g/km → $malus €",
      ({ today, from, g, malus, TVA }) => {
        expect(fiscalOn(today, { B: noon(from), "V.7": g })).toEqual({
          malus,
          TVA,
          chevaux: null,
        });
      },
    );

    it("additionne CO2 et masse avant la décote", () => {
      expect(
        fiscalOn("2026-10-15", {
          B: noon("2026-06-15"),
          "V.7": 120,
          G: 1500,
        }),
      ).toEqual({
        malus: 301,
        TVA: "TVA",
        chevaux: null,
      });
    });

    it("réunit malus, TVA et chevaux", () => {
      expect(
        fiscalOn("2026-06-15", { "V.7": 108, G: 1500, "P.2": 100 }),
      ).toEqual({
        malus: 60,
        TVA: "TVA",
        chevaux: { cv: 7, prix: 374.5 },
      });
    });
  });
});
