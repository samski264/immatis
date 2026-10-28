"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { onScanStatus, setScanStatus } from "@/lib/routeFlight";
import { SCAN_PHASE } from "@/lib/scanPhase";
import styles from "./css/ScanStatus.module.css";

function Mark({ status }) {
  if (status === "analyse") return <span className={styles.dot} aria-hidden="true" />;
  return (
    <svg className={styles.mark} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.2 8.2 6.4 11.4 12.8 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ScanStatus() {
  const pathname = usePathname();
  const [status, setStatus] = useState(null);

  useLayoutEffect(() => onScanStatus(setStatus), []);

  useLayoutEffect(() => {
    if (pathname === "/result") setScanStatus(null);
  }, [pathname]);

  const copy = SCAN_PHASE[status];
  const show = Boolean(copy) && pathname !== "/result";

  return (
    <div className={show ? styles.anchor : styles.rest} role="status" aria-live="polite">
      {show ? (
        <div key={status} className={styles.card}>
          <div className={styles.row}>
            <Mark status={status} />
            <p className={styles.title}>{copy.title}</p>
          </div>
          <p className={styles.detail}>{copy.detail}</p>
        </div>
      ) : null}
    </div>
  );
}
