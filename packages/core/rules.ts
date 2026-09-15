import type { CarCertificate, DrealStatus, Fiscale, Malus, TVA } from './types.ts'
import malusTable from "./json/malus.json" with { type: "json" };

const complet: CarCertificate = {
    "A": "AB-123-CD",                  // Immat
    "B": new Date("2025-03-31"),       // Date 1ère immat
    "C.1": "Dupont",                   // Titulaire
    "D.1": "Renault",                  // Marque
    "D.2": "XXX",                      // Type
    "D.3": "Clio",                     // Dénomination
    "E": "VF1XXXX",                    // VIN
    "F.1": null,                       // Masse max
    "G": 1200,                         // Masse service
    "H": null,                         // Validité
    "I": new Date("2020-01-01"),       // Date immat
    "J": "M1",                         // Catégorie
    "K": null,                         // Réception
    "P.1": 999,                        // Cylindrée
    "P.2": 67,                         // Puissance
    "P.3": "Essence",                  // Carburant
    "S.1": 5,                          // Places
    "V.7": 120,                        // CO2
    "V.9": "Euro 6",                   // Classe env
}



function hasReception(certificate: CarCertificate): DrealStatus {
    if (certificate.K != null) {   //do the car have a reception ?
        return null
    }
    return isAnAVDT(certificate)
}

function fiscal(certificate: CarCertificate): Fiscale {
    const from = certificate.B

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

    for (const valeur of Object.values(rest)) {
        if (valeur == null) return 'RTI'
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