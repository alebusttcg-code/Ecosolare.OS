'use client'

import { useEffect, useRef, useState } from 'react'
import { chiaveMapsPerMappa } from '@/lib/actions/sviluppo'
import { latiRettangolo, type AnalisiTetto, type FaldaTetto, type RettangoloGeo } from '@/lib/solar'

const MAX_FALDE_IN_MAPPA = 30
/** Con molte falde, le quote su ogni lato solo sulle più ampie (evita clutter). */
const MAX_FALDE_CON_QUOTE = 6

declare global {
  interface Window {
    google?: typeof google
    __ecoMapsInit?: () => void
  }
}

/** Carica Maps JavaScript una sola volta. */
function caricaMapsJs(apiKey: string): Promise<typeof google.maps> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Solo browser'))
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps)

  return new Promise((resolve, reject) => {
    const esistente = document.querySelector<HTMLScriptElement>('script[data-eco-maps]')
    if (esistente) {
      esistente.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps)
        else reject(new Error('Maps non disponibile'))
      })
      return
    }

    window.__ecoMapsInit = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Maps non disponibile'))
    }

    const script = document.createElement('script')
    script.dataset.ecoMaps = '1'
    script.async = true
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&callback=__ecoMapsInit&v=weekly`
    script.onerror = () => reject(new Error('Caricamento Maps fallito'))
    document.head.appendChild(script)
  })
}

function faldeDaMostrare(falde: readonly FaldaTetto[]): FaldaTetto[] {
  return [...falde]
    .sort((a, b) => b.areaMeters2 - a.areaMeters2)
    .slice(0, MAX_FALDE_IN_MAPPA)
}

function aggiungiQuoteLati(
  maps: typeof google.maps,
  mappa: google.maps.Map,
  box: RettangoloGeo,
  colore: string,
  destinazione: google.maps.Marker[],
) {
  for (const lato of latiRettangolo(box)) {
    if (lato.metri < 0.3) continue
    destinazione.push(
      new maps.Marker({
        map: mappa,
        position: { lat: lato.meta.latitude, lng: lato.meta.longitude },
        clickable: false,
        icon: {
          path: maps.SymbolPath?.CIRCLE ?? 0,
          scale: 0,
          labelOrigin: { x: 0, y: 0 },
        },
        label: {
          text: lato.etichetta,
          color: colore,
          fontSize: '11px',
          fontWeight: '700',
        },
        title: lato.etichetta,
        zIndex: 5,
      }),
    )
  }
}

export function MappaTetto({ analisi }: { analisi: AnalisiTetto }) {
  const contenitore = useRef<HTMLDivElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [modo, setModo] = useState<'caricamento' | 'interattiva' | 'statica'>('caricamento')

  const lat = analisi.location.latitude
  const lng = analisi.location.longitude
  const urlStatica = `/api/sviluppo/mappa?lat=${lat}&lng=${lng}&zoom=19`
  const urlEsterna =
    `https://www.google.com/maps/@${lat},${lng},19z/data=!3m1!1e3`

  useEffect(() => {
    let annullato = false
    const rettangoli: google.maps.Rectangle[] = []
    const markers: google.maps.Marker[] = []

    ;(async () => {
      try {
        const chiave = await chiaveMapsPerMappa()
        if (!chiave.ok || annullato) {
          if (!annullato) setModo('statica')
          return
        }

        const maps = await caricaMapsJs(chiave.data.apiKey)
        if (annullato || !contenitore.current) return

        const mappa = new maps.Map(contenitore.current, {
          center: { lat, lng },
          zoom: 19,
          mapTypeId: 'satellite',
          tilt: 0,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: ['satellite', 'hybrid', 'roadmap'],
          },
        })

        const bounds = new maps.LatLngBounds()
        bounds.extend({ lat, lng })

        if (analisi.boundingBox) {
          const edificio = new maps.Rectangle({
            map: mappa,
            bounds: {
              south: analisi.boundingBox.sw.latitude,
              west: analisi.boundingBox.sw.longitude,
              north: analisi.boundingBox.ne.latitude,
              east: analisi.boundingBox.ne.longitude,
            },
            strokeColor: '#e8c765',
            strokeOpacity: 0.95,
            strokeWeight: 2,
            fillColor: '#d9a441',
            fillOpacity: 0.12,
          })
          rettangoli.push(edificio)
          aggiungiQuoteLati(maps, mappa, analisi.boundingBox, '#e8c765', markers)
          bounds.extend({
            lat: analisi.boundingBox.sw.latitude,
            lng: analisi.boundingBox.sw.longitude,
          })
          bounds.extend({
            lat: analisi.boundingBox.ne.latitude,
            lng: analisi.boundingBox.ne.longitude,
          })
        }

        const selezionate = faldeDaMostrare(analisi.falde)
        const conQuote = new Set(
          selezionate.slice(0, MAX_FALDE_CON_QUOTE).map((f) => f.indice),
        )

        for (const falda of selezionate) {
          if (falda.boundingBox) {
            const r = new maps.Rectangle({
              map: mappa,
              bounds: {
                south: falda.boundingBox.sw.latitude,
                west: falda.boundingBox.sw.longitude,
                north: falda.boundingBox.ne.latitude,
                east: falda.boundingBox.ne.longitude,
              },
              strokeColor: '#5b9bd5',
              strokeOpacity: 0.85,
              strokeWeight: 1,
              fillColor: '#3f7fc4',
              fillOpacity: 0.22,
            })
            rettangoli.push(r)
            if (conQuote.has(falda.indice)) {
              aggiungiQuoteLati(maps, mappa, falda.boundingBox, '#cfe3f7', markers)
            }
            bounds.extend({
              lat: falda.boundingBox.sw.latitude,
              lng: falda.boundingBox.sw.longitude,
            })
            bounds.extend({
              lat: falda.boundingBox.ne.latitude,
              lng: falda.boundingBox.ne.longitude,
            })
          }

          if (falda.center) {
            const marker = new maps.Marker({
              map: mappa,
              position: {
                lat: falda.center.latitude,
                lng: falda.center.longitude,
              },
              label: {
                text: String(falda.indice + 1),
                color: '#050a14',
                fontSize: '11px',
                fontWeight: '700',
              },
              title: `Falda ${falda.indice + 1} · ${falda.areaMeters2.toFixed(0)} m²`,
            })
            markers.push(marker)
            bounds.extend({
              lat: falda.center.latitude,
              lng: falda.center.longitude,
            })
          }
        }

        if (!bounds.isEmpty()) {
          mappa.fitBounds(bounds, 48)
        }

        if (!annullato) {
          setModo('interattiva')
          setErrore(null)
        }
      } catch (e) {
        if (!annullato) {
          setModo('statica')
          setErrore(
            e instanceof Error
              ? e.message
              : 'Mappa interattiva non disponibile: uso vista satellitare statica.',
          )
        }
      }
    })()

    return () => {
      annullato = true
      for (const r of rettangoli) r.setMap(null)
      for (const m of markers) m.setMap(null)
    }
  }, [analisi, lat, lng])

  const selezionate = faldeDaMostrare(analisi.falde)
  const troncate = analisi.falde.length > selezionate.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Mappa del tetto</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Vista satellitare · quote in metri su ogni lato del riquadro
            {troncate
              ? ` · mostrate le ${selezionate.length} falde più ampie su ${analisi.falde.length}`
              : null}
          </p>
        </div>
        <a
          href={urlEsterna}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-eco-blue-300 hover:underline collega"
        >
          Apri in Google Maps →
        </a>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--bordo)', minHeight: 360 }}
      >
        <div
          ref={contenitore}
          className="h-[360px] w-full sm:h-[420px]"
          style={{ display: modo === 'statica' ? 'none' : 'block' }}
        />

        {modo === 'caricamento' ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: 'var(--testo-tenue)', background: 'rgba(5,10,20,0.55)' }}
          >
            Caricamento mappa…
          </div>
        ) : null}

        {modo === 'statica' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlStatica}
            alt={`Vista satellitare: ${analisi.formattedAddress}`}
            className="h-[360px] w-full object-cover sm:h-[420px]"
          />
        ) : null}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Le misure sono i lati del riquadro Solar (bounding box) di edificio e falde,
        non un rilievo CAD del perimetro reale. Oro = edificio; blu = falde (quote
        sulle {MAX_FALDE_CON_QUOTE} più ampie).
      </p>

      {errore && modo === 'statica' ? (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {errore} Abilita <strong>Maps JavaScript API</strong> (e Maps Static API per il
          fallback) sulla stessa chiave Google.
        </p>
      ) : null}
    </div>
  )
}
