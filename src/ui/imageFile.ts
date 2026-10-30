import { t } from '../i18n';

/** Downscale a photo to keep the project (and its JSON backup) small. */
export async function loadImage(file: File, maxPx = 1600): Promise<{ dataUrl: string; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error(t('Ezt a képet nem lehet megnyitni.', 'This image cannot be opened.')));
      img.src = url;
    });
    const k = Math.min(1, maxPx / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/jpeg', 0.82), aspect: img.height / img.width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

