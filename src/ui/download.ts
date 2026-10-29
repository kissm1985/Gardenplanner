export function downloadText(filename: string, text: string, mime: string) {
  // BOM so Excel opens Hungarian accents in CSV correctly.
  const body = mime.startsWith('text/csv') ? '﻿' + text : text;
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const readFileText = (f: File) => f.text();

export function downloadBlob(filename: string, data: Uint8Array, mime: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
