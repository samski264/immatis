"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { saveResult } from "@/lib/scanResult";
import Dropzone from "./Dropzone";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function readEvent(event, data) {
  if (event !== "certificate" && event !== "bilan") return data;
  return JSON.parse(data);
}

export default function Scan() {
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const received = useRef({});
  const sent = useRef(false);

  // Le payload RSC de /result est statique : le préfetch complet le met en cache
  // avant la fin du scan, donc le push n'attend pas un aller-retour réseau.
  useEffect(() => {
    router.prefetch("/result", { kind: "full" });
  }, [router]);

  const send = async (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("file", f));
    received.current = {};
    sent.current = false;
    setEvents({});

    let res;
    try {
      res = await fetch(`${API}/scans`, { method: "POST", body: form });
    } catch (err) {
      return setEvents({ error: err.message });
    }
    if (!res.ok) return setEvents({ error: await res.text() });

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
              saveResult({
                scannedAt: new Date().toISOString(),
                certificate: next.certificate,
                bilan: next.bilan,
              });
              router.push("/result");
            },
          })
        );
    } catch (err) {
      if (!sent.current) setEvents((current) => ({ ...current, error: err.message }));
    }
  };

  return (
    <>
      <Dropzone onFiles={send} />
      {events && <pre>{JSON.stringify(events, null, 2)}</pre>}
    </>
  );
}
