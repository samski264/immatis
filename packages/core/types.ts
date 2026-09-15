type CarCertificate = {
    "A": string | null;
    "B": Date | null;
    "C.1": string | null;
    "D.1": string | null;
    "D.2": string | null;
    "D.3": string | null;
    "E": string | null;
    "F.1": number | null;
    "G": number | null;
    "H": string | null;
    "I": Date | null;
    "J": string | null;
    "K": string | null;
    "P.1": number | null;
    "P.2": number | null;
    "P.3": string | null;
    "S.1": number | null;
    "V.7": number | null;
    "V.9": string | null;
};



type TVA = 'TVA' | null
type DrealStatus = 'AVDT' | 'RTI' | null
type Malus = number | null

type Fiscale = {
    TVA: TVA;
    malus: Malus;
} | null

type Bilan = {
    DREAL: DrealStatus;
}

export type { CarCertificate, DrealStatus, Bilan, Fiscale, Malus, TVA }

