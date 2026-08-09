/**
 * Normalizza un allegato scelto dal disco prima dell'upload.
 *
 * Dalla fotocamera («Scatta foto») arriva già un JPEG. Dal selettore file,
 * soprattutto su iPhone, arrivano spesso HEIC/HEIF o WebP che il server
 * rifiuta (solo JPEG, PNG, PDF per firma magica). Qui, se il browser sa
 * decodificare l'immagine, la riscriviamo in JPEG.
 */

const TIPI_PASSANTI = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
])

function estensione(nome: string): string {
  const i = nome.lastIndexOf('.')
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : ''
}

function ePdf(file: File): boolean {
  return file.type === 'application/pdf' || estensione(file.name) === 'pdf'
}

function eJpegOPng(file: File): boolean {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return true
  const ext = estensione(file.name)
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png'
}

async function caricaImmagine(file: File): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Safari a volte fallisce su HEIC con createImageBitmap: ripiega su Image.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () =>
        reject(
          new Error(
            'Questa foto non è leggibile dal browser (spesso è HEIC). Usa «Scatta foto» oppure esporta in JPEG o PNG.',
          ),
        )
      el.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function dimensioni(sorgente: CanvasImageSource): { w: number; h: number } {
  if (sorgente instanceof HTMLImageElement) {
    return { w: sorgente.naturalWidth || sorgente.width, h: sorgente.naturalHeight || sorgente.height }
  }
  if (typeof ImageBitmap !== 'undefined' && sorgente instanceof ImageBitmap) {
    return { w: sorgente.width, h: sorgente.height }
  }
  if (sorgente instanceof HTMLCanvasElement) {
    return { w: sorgente.width, h: sorgente.height }
  }
  return { w: 0, h: 0 }
}

async function convertiInJpeg(file: File): Promise<File> {
  const sorgente = await caricaImmagine(file)
  const { w: larghezza, h: altezza } = dimensioni(sorgente)

  if (!larghezza || !altezza) {
    throw new Error('Impossibile leggere le dimensioni della foto.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = larghezza
  canvas.height = altezza
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Conversione immagine non disponibile su questo dispositivo.')
  ctx.drawImage(sorgente, 0, 0)

  if ('close' in sorgente && typeof sorgente.close === 'function') {
    sorgente.close()
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Conversione in JPEG fallita.'))),
      'image/jpeg',
      0.92,
    )
  })

  const base = file.name.replace(/\.[^.]+$/, '') || 'foto'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

/**
 * Restituisce un file pronto per `uploadDocument`: PDF/JPEG/PNG invariati;
 * altre immagini convertite in JPEG quando il browser le decodifica.
 */
export async function normalizzaAllegato(file: File): Promise<File> {
  if (ePdf(file)) return file
  if (TIPI_PASSANTI.has(file.type) || eJpegOPng(file)) return file

  // HEIC, WebP, GIF, bitmap vari: tentativo di conversione.
  if (file.type.startsWith('image/') || ['heic', 'heif', 'webp', 'gif', 'tif', 'tiff', 'bmp'].includes(estensione(file.name))) {
    return convertiInJpeg(file)
  }

  // Tipo sconosciuto: lascia passare, il server valida i byte.
  return file
}
