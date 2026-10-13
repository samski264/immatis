"use client";

import { useState } from "react";
import { EventSourceParserStream } from "eventsource-parser/stream";
import Dropzone from "./Dropzone";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Scan() {
  const [events, setEvents] = useState(null);

  const send = async (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("file", f));
    setEvents({});

    const res = await fetch(`${API}/scans`, { method: "POST", body: form });
    if (!res.ok) return setEvents({ error: await res.text() });

    // pipeTo plutôt que `for await` : Safari n'itère pas les ReadableStream
    await res.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeTo(
        new WritableStream({
          write({ event, data }) {
            console.log(event)
            if (event) setEvents((e) => ({ ...e, [event]: data }));
          },
        })
      );
  };

  return (
    <>
      <Dropzone onFiles={send} />
      {events && <pre>{JSON.stringify(events, null, 2)}</pre>}
    </>
  );
}
