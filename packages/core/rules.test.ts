import { afterEach, describe, expect, it, vi } from "vitest";
import { getFiscal, getReception } from "./rules.ts";
import type { CarCertificate } from "./types.ts";

function certificate(overrides: Partial<CarCertificate> = {}): CarCertificate {
  return {
    A: "AB-123-CD",
    B: new Date("2026-06-15T12:00:00Z"),
    "C.1": "MARTIN",
    "D.1": "RENAULT",
    "D.2": "RJA",
    "D.3": "CLIO",
    E: "VF1RJA00012345678",
    "F.1": 1620,
    G: 1200,
    H: "2026-2036",
    I: new Date("2026-06-15T12:00:00Z"),
    J: "M1",
    K: "e1*2007/46*0458*11",
    "P.1": 1332,
    "P.2": 90,
    "P.3": "ES",
    "S.1": 5,
    "V.7": 110,
    "V.9": "EURO6",
    ...overrides,
  };
}

function fiscalLe(today: string, overrides: Partial<CarCertificate> = {}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${today}T12:00:00Z`));
  return getFiscal(certificate({ B: new Date(`${today}T12:00:00Z`), ...overrides }));
}

describe("getReception", () => {
  it("Tout les champs sont renseigné", () => {
    const resultat = getReception(certificate({K: null, "D.1": null}));
    expect(resultat).toBe("RTI");
  });

  it("K n'est pas renseigné et les autres champs oui -> AVDT", () => {
    const resultat = getReception(certificate({K: null}));
    expect(resultat).toBe("AVDT");
  });

  it("K n'est pas renseigné et les autres champs non -> RTI", () => {
    const resultat = getReception(certificate({K: null, "D.1": null}));
    expect(resultat).toBe("RTI");
  });
});



describe("getFiscal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("TVA", () => {
    it.each([
      { from: "2026-10-15", TVA: "TVA" },
      { from: "2026-07-15", TVA: "TVA" },
      { from: "2026-04-15", TVA: "TVA" },
      { from: "2026-03-15", TVA: null },
      { from: "2020-10-15", TVA: null },
    ])("immatriculée le $from, vue le 2026-10-15 : TVA = $TVA", ({ from, TVA }) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

      const resultat = getFiscal(certificate({ B: new Date(`${from}T12:00:00Z`) }));

      expect(resultat).toMatchObject({ TVA });
    });

    it("ne signale pas de TVA sans date de première immatriculation", () => {
      const resultat = getFiscal(certificate({ B: null }));
      expect(resultat).toMatchObject({ TVA: null });
    });
  });

  

  describe("exonération de malus", () => {
    it.each([
      { from: "2014-12-31", today: "2015-01-15", malus: null },
      { from: "2015-01-02", today: "2015-01-02", malus: 250 },
    ])("immatriculée le $from : malus = $malus", ({ from, today, malus }) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${today}T12:00:00Z`));

      const resultat = getFiscal(
        certificate({ B: new Date(`${from}T12:00:00Z`), "V.7": 140 }),
      );

      expect(resultat).toMatchObject({ malus });
    });

    it.each([
      { mois: 180, today: "2030-08-15", malus: 15 },
      { mois: 181, today: "2030-09-15", malus: null },
    ])("à $mois mois : malus = $malus", ({ today, malus }) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${today}T12:00:00Z`));

      const resultat = getFiscal(
        certificate({ B: new Date("2015-08-15T12:00:00Z"), "V.7": 140 }),
      );

      expect(resultat).toMatchObject({ malus });
    });
  });

  describe("chevaux fiscaux", () => {
    it("P.2 = 100 kW donne 7 CV, soit 374,5 €", () => {
      expect(getFiscal(certificate({ "P.2": 100 }))).toMatchObject({
        chevaux: { cv: 7, prix: 374.5 },
      });
    });

    it("laisse les chevaux vides sans P.2", () => {
      expect(getFiscal(certificate({ "P.2": null }))).toMatchObject({ chevaux: null });
    });
  });

  describe("malus CO2", () => {
    it.each([
      { today: "2025-12-31", malus: 0 },
      { today: "2026-01-01", malus: 50 },
    ])("108 g/km immatriculée le $today : $malus €", ({ today, malus }) => {
      expect(fiscalLe(today, { "V.7": 108 })).toMatchObject({ malus });
    });
  });

  describe("malus masse", () => {
    it.each([
      { today: "2021-06-15", G: 2200, malus: 0 },
      { today: "2025-12-31", G: 1600, malus: 10 },
      { today: "2026-01-01", G: 1600, malus: 1010 },
    ])("$G kg immatriculée le $today : $malus €", ({ today, G, malus }) => {
      expect(fiscalLe(today, { G, "V.7": null })).toMatchObject({ malus });
    });
  });

  describe("décote et cumul", () => {
    it("décote de 6 % à 4 mois", () => {
      expect(
        fiscalLe("2026-10-15", { B: new Date("2026-06-15T12:00:00Z"), "V.7": 108 }),
      ).toMatchObject({ malus: 47 });
    });

    it("additionne malus CO2 et malus masse", () => {
      expect(fiscalLe("2026-01-01", { "V.7": 108, G: 1600 })).toMatchObject({ malus: 1060 });
    });
  });
});