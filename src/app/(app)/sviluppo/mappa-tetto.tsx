'use client'

import { useEffect, useRef, useState } from 'react'
import { chiaveMapsPerMappa } from '@/lib/actions/sviluppo'
import {
  latiPoligono,
  poligoniQuasiUguali,
  type AnalisiTetto,
  type Coordinate,
  type FaldaTetto,
} from '@/lib/solar'

const MAX_FALDE_IN_MAPPA = 30

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

function aPath(vertici: readonly Coordinate[]): Array<{ lat: number; lng: number }> {
  return vertici.map((v) => ({ lat: v.latitude, lng: v.longitude }))
}

function daPath(path: google.maps.MVCArray<google.maps.LatLng>): Coordinate[] {
  const out: Coordinate[] = []
  for (let i = 0; i < path.getLength(); i++) {
    const p = path.getAt(i)
    out.push({ latitude: p.lat(), longitude: p.lng() })
  }
  return out
}

/**
 * Con una falda in editing, le altre non devono intercettare i click
 * sui manici (poligoni sovrapposti / marker).
 */
function stileFalda(selezionata: boolean, editingAttivo: boolean) {
  if (selezionata) {
    return {
      strokeColor: '#e8c765',
      strokeOpacity: 0.98,
      strokeWeight: 2.5,
      fillColor: '#d9a441',
      fillOpacity: 0.28,
      zIndex: 200,
      editable: true,
      clickable: true,
    }
  }
  return {
    strokeColor: '#5b9bd5',
    strokeOpacity: editingAttivo ? 0.4 : 0.75,
    strokeWeight: 1.25,
    fillColor: '#3f7fc4',
    fillOpacity: editingAttivo ? 0.05 : 0.16,
    zIndex: 5,
    editable: false,
    clickable: !editingAttivo,
  }
}

export interface MappaTettoProps {
  analisi: AnalisiTetto
  poligoni: Readonly<Record<number, readonly Coordinate[]>>
  faldaSelezionata: number | null
  onSeleziona: (indice: number | null) => void
  onPoligonoCambiato: (indice: number, vertici: Coordinate[]) => void
}

export function MappaTetto({
  analisi,
  poligoni,
  faldaSelezionata,
  onSeleziona,
  onPoligonoCambiato,
}: MappaTettoProps) {
  const contenitore = useRef<HTMLDivElement>(null)
  const mapsRef = useRef<typeof google.maps | null>(null)
  const mappaRef = useRef<google.maps.Map | null>(null)
  const edificioRef = useRef<google.maps.Rectangle | null>(null)
  const poligoniRef = useRef<Map<number, google.maps.Polygon>>(new Map())
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map())
  const quoteRef = useRef<google.maps.Marker[]>([])
  const pathListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const skipEmitRef = useRef(false)
  const onSelezionaRef = useRef(onSeleziona)
  const onPoligonoCambiatoRef = useRef(onPoligonoCambiato)
  const [errore, setErrore] = useState<string | null>(null)
  const [modo, setModo] = useState<'caricamento' | 'interattiva' | 'statica'>(
    'caricamento',
  )

  const lat = analisi.location.latitude
  const lng = analisi.location.longitude
  const urlStatica = `/api/sviluppo/mappa?lat=${lat}&lng=${lng}&zoom=19`
  const urlEsterna =
    `https://www.google.com/maps/@${lat},${lng},19z/data=!3m1!1e3`

  useEffect(() => {
    onSelezionaRef.current = onSeleziona
    onPoligonoCambiatoRef.current = onPoligonoCambiato
  }, [onSeleziona, onPoligonoCambiato])

  // Crea mappa una volta per analisi.
  useEffect(() => {
    let annullato = false
    const poligoniLocali = poligoniRef.current
    const markersLocali = markersRef.current
    const quoteLocali = quoteRef.current
    const pathListenersLocali = pathListenersRef.current

    ;(async () => {
      try {
        const chiave = await chiaveMapsPerMappa()
        if (!chiave.ok || annullato) {
          if (!annullato) setModo('statica')
          return
        }

        const maps = await caricaMapsJs(chiave.data.apiKey)
        if (annullato || !contenitore.current) return

        mapsRef.current = maps
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
        mappaRef.current = mappa

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
            strokeOpacity: 0.55,
            strokeWeight: 1.5,
            fillColor: '#d9a441',
            fillOpacity: 0.06,
            clickable: false,
            zIndex: 1,
          })
          edificioRef.current = edificio
          bounds.extend({
            lat: analisi.boundingBox.sw.latitude,
            lng: analisi.boundingBox.sw.longitude,
          })
          bounds.extend({
            lat: analisi.boundingBox.ne.latitude,
            lng: analisi.boundingBox.ne.longitude,
          })
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
      for (const l of pathListenersLocali) l.remove()
      pathListenersLocali.length = 0
      for (const q of quoteLocali) q.setMap(null)
      quoteLocali.length = 0
      for (const p of poligoniLocali.values()) {
        mapsRef.current?.event.clearInstanceListeners(p)
        p.setMap(null)
      }
      poligoniLocali.clear()
      for (const m of markersLocali.values()) {
        mapsRef.current?.event.clearInstanceListeners(m)
        m.setMap(null)
      }
      markersLocali.clear()
      edificioRef.current?.setMap(null)
      edificioRef.current = null
      mappaRef.current = null
      mapsRef.current = null
    }
  }, [analisi, lat, lng])

  // Sincronizza poligoni, selezione, quote.
  useEffect(() => {
    const maps = mapsRef.current
    const mappa = mappaRef.current
    if (!maps || !mappa || modo !== 'interattiva') return

    const mostrate = faldeDaMostrare(analisi.falde)
    const indiciAttivi = new Set(mostrate.map((f) => f.indice))

    for (const [indice, poly] of [...poligoniRef.current.entries()]) {
      if (!indiciAttivi.has(indice) || !poligoni[indice]) {
        maps.event.clearInstanceListeners(poly)
        poly.setMap(null)
        poligoniRef.current.delete(indice)
      }
    }
    for (const [indice, marker] of [...markersRef.current.entries()]) {
      if (!indiciAttivi.has(indice)) {
        maps.event.clearInstanceListeners(marker)
        marker.setMap(null)
        markersRef.current.delete(indice)
      }
    }

    for (const l of pathListenersRef.current) l.remove()
    pathListenersRef.current.length = 0

    const editingAttivo = faldaSelezionata != null

    for (const falda of mostrate) {
      const vertici = poligoni[falda.indice]
      if (!vertici || vertici.length < 3) continue

      const selezionata = faldaSelezionata === falda.indice
      let poly = poligoniRef.current.get(falda.indice)
      if (!poly) {
        poly = new maps.Polygon({
          map: mappa,
          paths: aPath(vertici),
          ...stileFalda(selezionata, editingAttivo),
        })
        poly.addListener('click', () => {
          onSelezionaRef.current(falda.indice)
        })
        poligoniRef.current.set(falda.indice, poly)
      } else {
        const correnti = daPath(poly.getPath())
        if (!poligoniQuasiUguali(correnti, vertici)) {
          skipEmitRef.current = true
          poly.setPath(aPath(vertici))
          skipEmitRef.current = false
        }
        poly.setOptions(stileFalda(selezionata, editingAttivo))
      }

      if (selezionata) {
        const path = poly.getPath()
        const emetti = () => {
          if (skipEmitRef.current) return
          onPoligonoCambiatoRef.current(falda.indice, daPath(path))
        }
        pathListenersRef.current.push(
          path.addListener('set_at', emetti),
          path.addListener('insert_at', emetti),
          path.addListener('remove_at', emetti),
        )
      }

      const centro =
        falda.center ??
        ({
          latitude:
            vertici.reduce((s, v) => s + v.latitude, 0) / vertici.length,
          longitude:
            vertici.reduce((s, v) => s + v.longitude, 0) / vertici.length,
        } satisfies Coordinate)

      // In editing i marker delle altre falde (e quello della selezionata)
      // restano sotto e non clickabili: altrimenti coprono i manici.
      const markerOpts = editingAttivo
        ? {
            clickable: false,
            opacity: selezionata ? 0.55 : 0.25,
            zIndex: 1,
          }
        : {
            clickable: true,
            opacity: 1,
            zIndex: 30,
          }

      let marker = markersRef.current.get(falda.indice)
      if (!marker) {
        marker = new maps.Marker({
          map: mappa,
          position: { lat: centro.latitude, lng: centro.longitude },
          label: {
            text: String(falda.indice + 1),
            color: '#050a14',
            fontSize: '11px',
            fontWeight: '700',
          },
          title: `Falda ${falda.indice + 1}`,
          ...markerOpts,
        })
        marker.addListener('click', () => {
          onSelezionaRef.current(falda.indice)
        })
        markersRef.current.set(falda.indice, marker)
      } else {
        marker.setOptions(markerOpts)
      }
    }

    for (const q of quoteRef.current) q.setMap(null)
    quoteRef.current.length = 0

    if (faldaSelezionata != null) {
      const vertici = poligoni[faldaSelezionata]
      if (vertici && vertici.length >= 2) {
        for (const lato of latiPoligono(vertici)) {
          if (lato.metri < 0.3) continue
          quoteRef.current.push(
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
                color: '#e8c765',
                fontSize: '12px',
                fontWeight: '700',
              },
              title: lato.etichetta,
              zIndex: 40,
            }),
          )
        }
      }
    }
  }, [analisi.falde, poligoni, faldaSelezionata, modo])

  const selezionate = faldeDaMostrare(analisi.falde)
  const troncate = analisi.falde.length > selezionate.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Mappa del tetto</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Seleziona una falda (marker o tabella), poi trascina i vertici
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
        style={{ borderColor: 'var(--bordo)', minHeight: 300 }}
      >
        <div
          ref={contenitore}
          className="h-[300px] w-full lg:h-[340px]"
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
            className="h-[300px] w-full object-cover lg:h-[340px]"
          />
        ) : null}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Oro tenue = edificio Solar. Blu = falde. La falda selezionata (oro) è
        editabile: i metri sui lati sono il rilievo del poligono, non il bbox
        Solar. Inclinazione ed esposizione restano stime Google.
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
