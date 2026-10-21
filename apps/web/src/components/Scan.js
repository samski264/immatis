"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { READ_MS, beginReading, endReading, flyTo } from "@/lib/routeFlight";
import { saveResult } from "@/lib/scanResult";
import Dropzone from "./Dropzone";
import styles from "./css/Dropzone.module.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const randomDate = (yearsAgo) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - yearsAgo);
  date.setMonth(Math.floor(Math.random() * 12));
  date.setDate(1 + Math.floor(Math.random() * 28));
  return date.toISOString().slice(0, 10);
};

function randomPayload() {
  const [brand, name, type] = pick([
    ["Volkswagen", "Golf", "3C"],
    ["BMW", "320d", "3D"],
    ["Audi", "A4", "8W"],
    ["Renault", "Mégane", "RFB"],
  ]);
  const years = pick([0, 2, 6, 11]);
  const kw = 70 + Math.floor(Math.random() * 130);
  const cv = Math.max(4, Math.round(kw / 10));
  const co2 = 95 + Math.floor(Math.random() * 130);
  const mass = 1150 + Math.floor(Math.random() * 650);
  const reception = Math.random() < 0.5 ? "AVDT" : "RTI";
  const plate = `${pick(["M", "B", "K", "S"])} ${pick(["AB", "CD", "EF"])} ${100 + Math.floor(Math.random() * 900)}`;

  const certificate = {
    A: plate,
    B: randomDate(years),
    "C.1": pick(["Martin", "Schmidt", "Dupont", "Keller"]),
    "D.1": brand,
    "D.2": type,
    "D.3": name,
    E: `WVWZZZ${Math.random().toString(36).slice(2, 8).toUpperCase()}000000`,
    "F.1": mass + 400,
    G: mass,
    H: "Illimitée",
    I: randomDate(0),
    J: pick(["M1", "N1"]),
    "P.1": 1200 + Math.floor(Math.random() * 800),
    "P.2": kw,
    "P.3": pick(["Essence", "Diesel", "Hybride"]),
    "S.1": pick([4, 5, 7]),
    "V.7": co2,
    "V.9": pick(["Euro 6", "Euro 6d", "Euro 5"]),
  };
  if (reception === "RTI") delete certificate["D.2"];

  return {
    scannedAt: new Date().toISOString(),
    certificate,
    bilan: {
      reception,
      fiscal: {
        TVA: years === 0 ? "TVA" : "exonéré",
        malus: years === 0 ? 0 : Math.round(co2 * (6 + Math.random() * 18)),
        chevaux: { cv, prix: cv * (40 + Math.floor(Math.random() * 16)) },
      },
    },
  };
}

function readEvent(event, data) {
  if (event !== "certificate" && event !== "bilan") return data;
  return JSON.parse(data);
}

export default function Scan() {
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const [reading, setReading] = useState(false);
  const received = useRef({});
  const sent = useRef(false);
  const busy = useRef(false);

  const finish = (payload, startedAt) => {
    saveResult(payload);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduce ? 0 : Math.max(0, READ_MS - (performance.now() - startedAt));
    window.setTimeout(() => flyTo(router, "/result"), wait);
  };

  const abortReading = (error) => {
    busy.current = false;
    setReading(false);
    endReading();
    if (error) setEvents({ error });
  };

  // Le payload RSC de /result est statique : le préfetch complet le met en cache
  // avant la fin du scan, donc le push n'attend pas un aller-retour réseau.
  useEffect(() => {
    router.prefetch("/result", { kind: "full" });
  }, [router]);

  const send = async (files) => {
    if (busy.current) return;
    busy.current = true;
    const startedAt = performance.now();
    setReading(true);
    beginReading();
    const form = new FormData();
    files.forEach((f) => form.append("file", f));
    received.current = {};
    sent.current = false;
    setEvents({});

    let res;
    try {
      res = await fetch(`${API}/scans`, { method: "POST", body: form });
    } catch (err) {
      return abortReading(err.message);
    }
    if (!res.ok) return abortReading(await res.text());

    // pipeTo plutôt que `for await` : Safari n'itère pas les ReadableStream
    try {
      await res.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeTo(
          new WritableStream({
            write({ event, data }) {
              if (!event || sent.current) return;
              let value = data;
              try {
                value = readEvent(event, data);
              } catch {
                value = data;
              }
              const next = { ...received.current, [event]: value };
              received.current = next;
              setEvents(next);
              if (event === "error") return;
              if (!next.certificate || !next.bilan) return;
              if (typeof next.certificate !== "object" || typeof next.bilan !== "object") return;
              sent.current = true;
              finish(
                {
                  scannedAt: new Date().toISOString(),
                  certificate: next.certificate,
                  bilan: next.bilan,
                },
                startedAt
              );
            },
          })
        );
    } catch (err) {
      if (!sent.current) abortReading(err.message);
    }
  };

  const tryRandom = () => {
    if (busy.current) return;
    busy.current = true;
    setReading(true);
    beginReading();
    const startedAt = performance.now();
    finish(randomPayload(), startedAt);
  };

  return (
    <div className={styles.stack}>
      <Dropzone onFiles={send} reading={reading} />
      <button type="button" className={styles.test} onClick={tryRandom} disabled={reading}>
        {reading ? "Lecture en cours" : "Test · données aléatoires"}
      </button>
      {events && <pre>{JSON.stringify(events, null, 2)}</pre>}
    </div>
  );
}
