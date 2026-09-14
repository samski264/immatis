type TextField = {
    libelle: string;
    valeur: string | Date | null;
};

type NumberField = {
    libelle: string;
    valeur: number | null;
};

type DateField = {
    libelle: string;
    valeur: Date | null;
};

type CarCertificate = {
    "A": TextField;
    "B": DateField;
    "C.1": TextField;
    "D.1": TextField;
    "D.2": TextField;
    "D.3": TextField;
    "E": TextField;
    "F.1": NumberField;
    "G": NumberField;
    "H": TextField;
    "I": TextField;
    "J": TextField;
    "K": TextField;
    "P.1": NumberField;
    "P.2": NumberField;
    "P.3": TextField;
    "S.1": NumberField;
    "V.7": NumberField;
    "V.9": TextField;
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

export type { CarCertificate, NumberField, TextField, DrealStatus, Bilan, Fiscale, Malus, TVA }

