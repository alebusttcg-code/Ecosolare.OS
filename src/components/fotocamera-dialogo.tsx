'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialogo } from '@/components/dialogo'

async function apriStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('unsupported')
  }

  const tentativi: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false },
  ]

  let ultimo: unknown
  for (const vincoli of tentativi) {
    try {
      return await navigator.mediaDevices.getUserMedia(vincoli)
    } catch (e) {
      ultimo = e
    }
  }
  throw ultimo ?? new Error('denied')
}

function FotocameraLive({
  onChiudi,
  onScatto,
}: {
  onChiudi: () => void
  onScatto: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [scattando, setScattando] = useState(false)

  useEffect(() => {
    let annullato = false
    let stream: MediaStream | null = null
    const video = videoRef.current

    void (async () => {
      try {
        stream = await apriStream()
        if (annullato) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (!video) return
        video.srcObject = stream
        await video.play()
        if (!annullato) setPronto(true)
      } catch {
        if (!annullato) {
          setErrore(
            'Impossibile accedere alla fotocamera. Controlla i permessi del browser o usa «Carica foto».',
          )
        }
      }
    })()

    return () => {
      annullato = true
      stream?.getTracks().forEach((t) => t.stop())
      if (video) video.srcObject = null
    }
  }, [])

  function scatta() {
    const video = videoRef.current
    if (!video || !pronto || scattando) return

    setScattando(true)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setScattando(false)
      return
    }
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        setScattando(false)
        if (!blob) return
        const file = new File([blob], `scatto-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onScatto(file)
        onChiudi()
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--bordo)',
          background: 'rgba(0,0,0,0.55)',
          aspectRatio: '4 / 3',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ opacity: pronto ? 1 : 0.35 }}
        />
        {!pronto && !errore ? (
          <p
            className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm"
            style={{ color: 'var(--testo-tenue)' }}
          >
            Avvio fotocamera…
          </p>
        ) : null}
      </div>

      {errore ? (
        <p className="text-sm" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </p>
      ) : (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Inquadra il soggetto e premi il pulsante per allegare lo scatto.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onChiudi}
          className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
        >
          Annulla
        </button>
        <button
          type="button"
          disabled={!pronto || scattando || Boolean(errore)}
          onClick={scatta}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          style={{
            borderColor: 'rgba(217,164,65,0.45)',
            background: 'rgba(217,164,65,0.12)',
            color: 'var(--color-eco-gold-300)',
          }}
        >
          {scattando ? 'Salvataggio…' : 'Scatta'}
        </button>
      </div>
    </div>
  )
}

/**
 * Anteprima live e scatto tramite fotocamera del dispositivo.
 *
 * Su desktop l'attributo `capture` dell'input file non apre la webcam: serve
 * `getUserMedia`. Su telefono offre la stessa esperienza in-app, senza passare
 * dal selettore di sistema.
 */
export function FotocameraDialogo({
  aperto,
  onChiudi,
  onScatto,
}: {
  aperto: boolean
  onChiudi: () => void
  onScatto: (file: File) => void
}) {
  return (
    <Dialogo aperto={aperto} titolo="Scatta fotografia" onChiudi={onChiudi} larghezza="lg">
      {aperto ? <FotocameraLive onScatto={onScatto} onChiudi={onChiudi} /> : null}
    </Dialogo>
  )
}
