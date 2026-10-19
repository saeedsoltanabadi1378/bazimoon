import { readLocal, writeLocal } from "./storage";

export interface AcquisitionAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  landingPath: string;
  gclid: string | null;
}

const STORAGE_KEY = "bazimoon-first-touch";

/** Captures the first landing touch on this browser. The server owns normalization and limits. */
export function getFirstTouchAttribution(): AcquisitionAttribution {
  const saved = readLocal<AcquisitionAttribution | null>(STORAGE_KEY, null);
  if (saved) return saved;

  const params = new URLSearchParams(window.location.search);
  const value = (name: string) => params.get(name)?.trim() || null;
  const attribution: AcquisitionAttribution = {
    source: value("utm_source"),
    medium: value("utm_medium"),
    campaign: value("utm_campaign"),
    term: value("utm_term"),
    content: value("utm_content"),
    referrer: cleanReferrer(document.referrer),
    landingPath: window.location.pathname,
    gclid: value("gclid"),
  };
  writeLocal(STORAGE_KEY, attribution);
  return attribution;
}

function cleanReferrer(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? `${url.origin}${url.pathname}` : null;
  } catch {
    return null;
  }
}
