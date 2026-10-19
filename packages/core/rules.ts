import type { CarCertificate, Chevaux, DrealStatus, Fiscale, Malus, TVA } from './types.ts'
import malusTable from "./json/malus.json" with { type: "json" };
import co2 from './json/co2.json' with {type: "json"}
import masse from './json/masse.json' with {type: "json"}
import cheval from './json/cheval.json' with {type: "json"}



export function hasReception(certificate: CarCertificate): DrealStatus {
    if (certificate.K != null) {   //do the car have a reception ?
        return null
    }
    return isAnAVDT(certificate)
}

function isAnAVDT(certificate: CarCertificate): DrealStatus {
    const { K, J, "V.7": v7, "V.9": v9, ...rest } = certificate    //destructuration for requiered and minimal RTI/AVDT fields 

    for (const valeur of Object.values(rest)) {
        if (valeur == null) return 'RTI'
    }
    return 'AVDT'
}




export function getFiscal(certificate: CarCertificate): Fiscale {
    const from = certificate.B
    const chevaux = getChevauxFiscaux(certificate["P.2"])

    if (from == null) return chevaux == null ? null : { malus: null, TVA: null, chevaux }

    let today = new Date()
    const diffMonths = (today.getFullYear() - from.getFullYear()) * 12 + (today.getMonth() - from.getMonth())

    return {
        malus: exemptedMalus(diffMonths, from) ? null : malus(certificate, from, diffMonths),
        TVA: isTVA(diffMonths),
        chevaux
    }
}

function malus(certificate: CarCertificate, from: Date, diffMonths: number): Malus {
    const g = certificate["V.7"]
    const kg = certificate.G
    if (g == null && kg == null) return null

    const brut = (g == null ? 0 : getMalus(from, g)) + (kg == null ? 0 : getMalusMasse(from, kg))
    const decote = abbatement(certificate, diffMonths) ?? 0
    return Math.round(brut * (100 - decote) / 100)
}

function abbatement(certificate: CarCertificate, diffMonths: number): Malus {
    
    function searchAbbatement(x: any) {
        if (x.max >= diffMonths && diffMonths >= x.min) return true
        else return false
    }

    return malusTable.tranches.find(searchAbbatement)?.decote || null
}


function isTVA(diffMonths: number): TVA {
    if (diffMonths <= 6) return 'TVA'
    return null
}



function exemptedMalus(months: number, from: Date): boolean {
    if (months >= 181) return true
    if (from <= new Date("2015-01-01")) return true
    return false
}



function getMalus(from: Date, g: number): number {
    const day = from.toISOString().slice(0, 10)

    function searchBareme(x: any) {
        if (x.valid_from <= day && day <= x.valid_to) return true
        else return false
    }

    const bareme: any = co2.baremes.find(searchBareme)
    if (bareme == null || g < bareme.threshold_g_km) return 0
    if (g > bareme.cap_above_g_km) return bareme.cap_eur
    return bareme.tarifs?.[g] ?? bareme.bands?.find((x: any) => x.max >= g && g >= x.min)?.tarif ?? 0
}

function getChevauxFiscaux(pm: number | null): Chevaux {
    if (pm == null) return null

    const { a, b, c } = cheval.formule
    const cv = Math.round(a * (pm / 100) ** 2 + b * (pm / 100) + c)
    return { cv, prix: Math.round(cv * cheval.prix_moyen * 100) / 100 }
}

function getMalusMasse(from: Date, kg: number): number {
    const day = from.toISOString().slice(0, 10)
    const masseKg = Math.round(kg)

    function searchBareme(x: any) {
        if (x.valid_from <= day && (x.valid_to == null || day <= x.valid_to)) return true
        else return false
    }

    const bareme: any = masse.baremes.find(searchBareme)
    if (bareme == null || masseKg < bareme.threshold_kg) return 0

    let total = 0
    for (const band of bareme.bands) {
        if (masseKg < band.min || band.tarif === 0) continue
        const plafond = band.max ?? masseKg
        total += (Math.min(masseKg, plafond) - band.min + 1) * band.tarif
    }
    return total
}