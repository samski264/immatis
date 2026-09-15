import * as z from "zod";
import minimalCoc from "./json/minimal_coc.json" with { type: "json" };
import type { CarCertificate } from "./types.ts";

const text = z.string().nullable()
const nombre = z.number().nullable()
const date   = z.iso.date().nullable()

export const cocSchema = z.object({
  "A": text,
  "B": date,
  "C.1": text,
  "D.1": text,
  "D.2": text,
  "D.3": text,
  "E": text,
  "F.1": nombre,
  "G": nombre,
  "H": text,
  "I": date,
  "J": text,
  "K": text,
  "P.1": nombre,
  "P.2": nombre,
  "P.3": text,
  "S.1": nombre,
  "V.7": nombre,
  "V.9": text,
});



const toDate = (v: string | null) => v === null ? null : new Date(v);

export function conformSchema(x: z.infer<typeof cocSchema>) : CarCertificate{
    return { ...x, "B": toDate(x["B"]), "I": toDate(x["I"]) };
}
