import type { CarCertificate, DrealStatus, Fiscale, Malus, TVA } from './types.ts'
import malusTable from "./json/malus.json" with { type: "json" };

const complet: CarCertificate = {
    "A": { libelle: "Immat", valeur: "AB-123-CD" },
    "B": { libelle: "Date 1ère immat", valeur: new Date("2025-03-31") },
    "C.1": { libelle: "Titulaire", valeur: "Dupont" },
    "D.1": { libelle: "Marque", valeur: "Renault" },
    "D.2": { libelle: "Type", valeur: "XXX" },
    "D.3": { libelle: "Dénomination", valeur: "Clio" },
    "E": { libelle: "VIN", valeur: "VF1XXXX" },
    "F.1": { libelle: "Masse max", valeur: null },
    "G": { libelle: "Masse service", valeur: 1200 },
    "H": { libelle: "Validité", valeur: null },
    "I": { libelle: "Date immat", valeur: "01/01/2020" },
    "J": { libelle: "Catégorie", valeur: "M1" },
    "K": { libelle: "Réception", valeur: null },
    "P.1": { libelle: "Cylindrée", valeur: 999 },
    "P.2": { libelle: "Puissance", valeur: 67 },
    "P.3": { libelle: "Carburant", valeur: "Essence" },
    "S.1": { libelle: "Places", valeur: 5 },
    "V.7": { libelle: "CO2", valeur: 120 },
    "V.9": { libelle: "Classe env", valeur: "Euro 6" },
}



function hasReception(certificate: CarCertificate): DrealStatus {
    if (certificate.K.valeur != null) {   //do the car have a reception ?
        return null
    }
    return isAnAVDT(certificate)
}

function fiscal(certificate: CarCertificate): Fiscale {
    const from = certificate.B.valeur

    if (from == null) return null
    const months =
        (new Date().getFullYear() - from.getFullYear()) * 12 +
        (new Date().getMonth() - from.getMonth())

    console.log(from.getFullYear())

    if (exemptedMalus(months, from)) return null
    



    
    return {
        malus: abbatement(certificate, months),
        TVA: isTVA(certificate, months)
    }
}

function isAnAVDT(certificate: CarCertificate): DrealStatus {
    const { K, J, "V.7": v7, "V.9": v9, ...rest } = certificate    //destructuration for requiered and minimal RTI/AVDT fields 

    for (const field of Object.values(rest)) {
        if (field.valeur == null) return 'RTI'
    }
    return 'AVDT'
}





function abbatement(certificate: CarCertificate, months: number): Malus {
    function searchForMalus(x: any) {
        if (x.max >= months && months >= x.min) return true
        else return false
    }

    return malusTable.tranches.find(searchForMalus)?.decote || null
}


function isTVA(certificate: CarCertificate, months: number): TVA {
    if (months <= 6) return 'TVA'
    return null
}



function exemptedMalus(months: number, from: Date): boolean {
    if (months >= 181) return true
    if (from <= new Date("2015-01-01")) return true
    return false
}


fiscal(complet)