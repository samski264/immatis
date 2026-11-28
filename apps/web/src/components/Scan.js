"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { abortProcessing, completeProcessing, setScanStatus, startProcessing } from "@/lib/routeFlight";
import { saveResult } from "@/lib/scanResult";
import { scanTools } from "@/lib/scanTools";
import { registerTools } from "@/lib/webmcp";
import Dropzone from "./Dropzone";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function readEvent(event, data) {
  if (event !== "certificate" && event !== "bilan") return data;
  return JSON.parse(data);
}

// L'upload SSE arrive dès que le fichier est reçu, bien avant la fin de l'OCR.
const UPLOAD_BEAT_MS = 1200;

const DEPOSIT_WAIT_MS = 120_000;

export default function Scan({ inputId, formats }) {
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const [reading, setReading] = useState(false);
  const [phase, setPhase] = useState(null);
  const received = useRef({});
  const sent = useRef(false);
  const busy = useRef(false);
  const phaseTimer = useRef(0);
  const phaseRef = useRef(null);
  const outcome = useRef(null);
  const settled = useRef(new Set());

  const settle = (next) => {
    outcome.current = next;
    settled.current.forEach((listener) => listener(next));
  };

  const publishPhase = (next) => {
    phaseRef.current = next;
    setPhase(next);
    setScanStatus(next);
  };

  const stopPhase = () => {
    window.clearTimeout(phaseTimer.current);
    publishPhase(null);
  };

  // Upload OK reste lisible, puis l'analyse occupe le reste du vol.
  const showUpload = () => {
    if (phaseRef.current === "upload" || phaseRef.current === "analyse") return;
    publishPhase("upload");
    window.clearTimeout(phaseTimer.current);
    phaseTimer.current = window.setTimeout(() => {
      if (phaseRef.current !== "upload") return;
      publishPhase("analyse");
    }, UPLOAD_BEAT_MS);
  };

  useEffect(() => () => window.clearTimeout(phaseTimer.current), []);

  const finish = (payload) => {
    settle({ payload });
    saveResult(payload);
    completeProcessing(router);
  };

  const abortReading = (error) => {
    busy.current = false;
    setReading(false);
    stopPhase();
    abortProcessing();
    if (error) setEvents({ error });
    settle({ error: error || "Lecture interrompue." });
  };

  // Le payload RSC de /result est statique : le préfetch complet le met en cache
  // avant la fin du scan, donc le push n'attend pas un aller-retour réseau.
  useEffect(() => {
    router.prefetch("/result", { kind: "full" });
  }, [router]);

  const send = async (files) => {
    if (busy.current) return;
    busy.current = true;
    setReading(true);
    stopPhase();
    startProcessing();
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
              if (event === "upload") showUpload();
              if (event === "error") {
                abortReading(typeof value === "string" ? value : "Lecture interrompue.");
                return;
              }
              if (!next.certificate || !next.bilan) return;
              if (typeof next.certificate !== "object" || typeof next.bilan !== "object") return;
              sent.current = true;
              finish({
                scannedAt: new Date().toISOString(),
                certificate: next.certificate,
                bilan: next.bilan,
              });
            },
          })
        );
      if (!sent.current && busy.current) abortReading("La lecture n'a pas abouti.");
    } catch (err) {
      if (!sent.current) abortReading(err.message);
    }
  };

  const tryExample = async () => {
    if (busy.current) return;
    busy.current = true;
    setReading(true);
    stopPhase();
    startProcessing();
    let res;
    try {
      res = await fetch("/example");
    } catch (err) {
      return abortReading(err.message);
    }
    if (!res.ok) return abortReading(await res.text());
    showUpload();
    try {
      finish(await res.json());
    } catch (err) {
      abortReading(err.message);
    }
  };

  const runForAgent = useEffectEvent(async (files) => {
    if (busy.current) return { error: "Une lecture est déjà en cours." };
    outcome.current = null;
    await (files ? send(files) : tryExample());
    return outcome.current ?? { error: "La lecture n'a pas abouti." };
  });

  const waitForDeposit = useEffectEvent((signal) => {
    const zone = document.getElementById(inputId)?.parentElement;
    zone?.scrollIntoView({ behavior: "smooth", block: "center" });
    zone?.focus({ preventScroll: true });

    return new Promise((resolve) => {
      const done = (next) => {
        settled.current.delete(done);
        window.clearTimeout(timer);
        resolve(next);
      };
      const timer = window.setTimeout(
        () => done({ error: "Aucune carte grise déposée par l'utilisateur." }),
        DEPOSIT_WAIT_MS,
      );
      signal?.addEventListener("abort", () => done({ error: "Attente annulée." }));
      settled.current.add(done);
    });
  });

  useEffect(
    () =>
      registerTools(
        scanTools({
          scan: (files) => runForAgent(files),
          example: () => runForAgent(null),
          awaitDeposit: (signal) => waitForDeposit(signal),
        }),
      ),
    [],
  );

  return (
    <>
      <Dropzone
        inputId={inputId}
        formats={formats}
        onFiles={send}
        onExample={tryExample}
        reading={reading}
        phase={phase}
      />
      {events?.error ? <pre>{events.error}</pre> : null}
    </>
  );
}
