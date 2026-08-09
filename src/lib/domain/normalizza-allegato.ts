/**
 * Prepara un allegato prima dell'upload via server action.
 *
 * Su Vercel il corpo delle Server Action è limitato (~4.5 MB). Le foto
 * dalla galleria (HEIC/JPEG da 3–8 MB) superano spesso il default Next (1 MB)
 * e falliscono senza messaggio utile. Qui:
 *  - i formati ammessi piccoli passano invariati;
 *  - le immagini grandi vengono ridimensionate/ricompresse in JPEG;
 *  - PDF oltre il limite di rete restano bloccati con messaggio chiaro.
 */

import {
  DIMENSIONE_MASSIMA_UPLOAD,
  formattaDimensione,
} from '@/lib/domain/upload'

const TIPI_PASSANTI = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

const ESTENSIONI_IMMAGINE = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'gif',
  'tif',
  'tiff',
  'bmp',
])

/** Soglia sotto cui non conviene ricomprimere (scatti già piccoli). */
const SOGLIA_COMPRESSIONE = 900 * 1024

/** Lato lungo massimo dopo il ridimensionamento. */
const LATO_MASSIMO = 2048

function estensione(nome: string): string {
  const i = nome.lastIndexOf('.')
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : ''
}

function ePdf(file: File): boolean {
  return file.type === 'application/pdf' || estensione(file.name) === 'pdf'
}

function eImmagine(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return ESTENSIONI_IMMAGINE.has(estensione(file.name))
}

async function caricaImmagine(file: File): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Ripiega su Image (utile su Safari/HEIC).
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () =>
        reject(
          new Error(
            'Questa foto non è leggibile dal browser. Usa «Scatta foto» oppure esporta in JPEG/PNG.',
          ),
        )
      el.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function dimensioni(sorgente: CanvasImageSource): { w: number; h: number } {
  if (sorgente instanceof HTMLImageElement) {
    return {
      w: sorgente.naturalWidth || sorgente.width,
      h: sorgente.naturalHeight || sorgente.height,
    }
  }
  if (typeof ImageBitmap !== 'undefined' && sorgente instanceof ImageBitmap) {
    return { w: sorgente.width, h: sorgente.height }
  }
  if (sorgente instanceof HTMLCanvasElement) {
    return { w: sorgente.width, h: sorgente.height }
  }
  return { w: 0, h: 0 }
}

async function blobDaCanvas(
  canvas: HTMLCanvasElement,
  qualita: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compressione immagine fallita.'))),
      'image/jpeg',
      qualita,
    )
  })
}

/**
 * Ridimensiona e ricomprime in JPEG finché il file sta sotto il limite di rete,
 * oppure fino a una qualità minima accettabile.
 */
async function comprimiInJpeg(file: File): Promise<File> {
  const sorgente = await caricaImmagine(file)
  const { w: origW, h: origH } = dimensioni(sorgente)
  if (!origW || !origH) {
    throw new Error('Impossibile leggere le dimensioni della foto.')
  }

  const scala = Math.min(1, LATO_MASSIMO / Math.max(origW, origH))
  const larghezza = Math.max(1, Math.round(origW * scala))
  const altezza = Math.max(1, Math.round(origH * scala))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Compressione immagine non disponibile su questo dispositivo.')

  const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
  let migliore: Blob | null = null

  for (const fattore of [1, 0.75, 0.55]) {
    canvas.width = Math.max(1, Math.round(larghezza * fattore))
    canvas.height = Math.max(1, Math.round(altezza * fattore))
    ctx.drawImage(sorgente, 0, 0, canvas.width, canvas.height)

    for (const qualita of [0.85, 0.72, 0.58]) {
      const blob = await blobDaCanvas(canvas, qualita)
      if (!migliore || blob.size < migliore.size) migliore = blob
      if (blob.size <= DIMENSIONE_MASSIMA_UPLOAD) {
        if ('close' in sorgente && typeof sorgente.close === 'function') sorgente.close()
        return new File([blob], `${base}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })
      }
    }
  }

  if ('close' in sorgente && typeof sorgente.close === 'function') sorgente.close()

  if (migliore && migliore.size <= DIMENSIONE_MASSIMA_UPLOAD) {
    return new File([migliore], `${base}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  }

  throw new Error(
    `La foto pesa ancora ${formattaDimensione(migliore?.size ?? file.size)} dopo la compressione (limite ${formattaDimensione(DIMENSIONE_MASSIMA_UPLOAD)}). Usa «Scatta foto» oppure un file più leggero.`,
  )
}

/**
 * Restituisce un file pronto per l'upload: immagini grandi compresse;
 * PDF e file già piccoli invariati.
 */
export async function normalizzaAllegato(file: File): Promise<File> {
  if (ePdf(file)) {
    if (file.size > DIMENSIONE_MASSIMA_UPLOAD) {
      throw new Error(
        `Il PDF pesa ${formattaDimensione(file.size)}: il limite di caricamento è ${formattaDimensione(DIMENSIONE_MASSIMA_UPLOAD)}.`,
      )
    }
    return file
  }

  if (eImmagine(file)) {
    // Scatti già piccoli (es. dalla fotocamera in-app): nessun passaggio inutile.
    if (
      file.size <= SOGLIA_COMPRESSIONE &&
      (TIPI_PASSANTI.has(file.type) ||
        ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(estensione(file.name)))
    ) {
      return file
    }
    return comprimiInJpeg(file)
  }

  if (file.size > DIMENSIONE_MASSIMA_UPLOAD) {
    throw new Error(
      `Il file pesa ${formattaDimensione(file.size)}: il limite di caricamento è ${formattaDimensione(DIMENSIONE_MASSIMA_UPLOAD)}.`,
    )
  }

  return file
}
