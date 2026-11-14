// Pro tier: the nursery's or garden designer's own header on printed plans and PDFs (PL-FUN-05). Kept per device.
import { useSyncExternalStore } from 'react';

export interface PdfHeader {
  /** Downscaled logo, data URL. */
  logo?: string;
  company: string;
  /** Address, phone, e-mail – one line. */
  contact: string;
  /** Days the quote is valid for (0 = do not print). */
  validDays: number;
  /** Customer name printed under the title (optional, per print). */
  customer?: string;
}

const KEY = 'kerttervezo.pdfHeader';
const listeners = new Set<() => void>();
const EMPTY: PdfHeader = { company: '', contact: '', validDays: 30 };

function read(): PdfHeader {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v === 'object') return { ...EMPTY, ...v };
  } catch {
    /* none */
  }
  return EMPTY;
}

let current = read();
export const getPdfHeader = () => current;
export function setPdfHeader(h: PdfHeader) {
  current = h;
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* too big or private mode: this session only */
  }
  listeners.forEach((f) => f());
}
export function usePdfHeader(): PdfHeader {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    getPdfHeader,
    getPdfHeader,
  );
}
export const hasPdfHeader = (h: PdfHeader) => !!(h.company.trim() || h.logo);
