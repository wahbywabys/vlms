/**
 * Instant photo capture for workshop tablets and phones. The camera opens
 * through <input type="file" accept="image/*" capture="environment">, which
 * works on every mobile browser without a permission prompt. Photos are
 * downscaled to at most 1600 px and re-encoded as JPEG before upload, so a
 * 12 MP shot (~4 MB) becomes ~250 KB, which matters on workshop Wi-Fi and
 * when the outbox holds photos until the device reconnects.
 */
export interface Captured {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  capturedAt: string;
}

export async function compressImage(file: File | Blob, maxSide = 1600, quality = 0.8): Promise<Captured> {
  const capturedAt = new Date().toISOString();
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return { blob: file, url: URL.createObjectURL(file), width: 0, height: 0, capturedAt };
  }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => null);
  if (!bmp) return { blob: file, url: URL.createObjectURL(file), width: 0, height: 0, capturedAt };
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
  return { blob, url: URL.createObjectURL(blob), width: w, height: h, capturedAt };
}

/** Upload one file to POST {base}/media; resolves with the server's id and hash. */
export async function uploadMedia(base: string, c: { blob: Blob; capturedAt: string; width?: number; height?: number; clientMutationId: string;
  kind?: 'photo' | 'video' | 'signature'; lat?: number; lon?: number }) {
  const headers: Record<string, string> = {
    'content-type': c.blob.type || 'image/jpeg', 'x-client-mutation-id': c.clientMutationId, 'x-captured-at': c.capturedAt,
    ...(c.kind ? { 'x-kind': c.kind } : {}), ...(c.width ? { 'x-width': String(c.width) } : {}), ...(c.height ? { 'x-height': String(c.height) } : {}),
    ...(c.lat !== undefined ? { 'x-lat': String(c.lat) } : {}), ...(c.lon !== undefined ? { 'x-lon': String(c.lon) } : {}),
  };
  const r = await fetch(`${base}/media`, { method: 'POST', headers, body: c.blob });
  if (!r.ok) throw new Error(`upload ${r.status}`);
  return (await r.json()) as { id: string; sha256: string; bytes: number };
}
