"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { abortProcessing, completeProcessing, startProcessing } from "@/lib/routeFlight";
import { saveResult } from "@/lib/scanResult";
import Dropzone from "./Dropzone";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function readEvent(event, data) {
  if (event !== "certificate" && event !== "bilan") return data;
  return JSON.parse(data);
}

export default function Scan({ inputId }) {
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const [reading, setReading] = useState(false);
  const received = useRef({});
  const sent = useRef(false);
  const busy = useRef(false);

  const finish = (payload) => {
    saveResult(payload);
    completeProcessing(router);
  };

  const abortReading = (error) => {
    busy.current = false;
    setReading(false);
    abortProcessing();
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
    setReading(true);
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

  return (
    <>
      <Dropzone inputId={inputId} onFiles={send} reading={reading} />
      {events?.error ? <pre>{events.error}</pre> : null}
    </>
  );
}
