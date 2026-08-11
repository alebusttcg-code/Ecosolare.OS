'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { chiaveMapsPerMappa } from '@/lib/actions/sviluppo'
import {
  latiPoligono,
  metriFra,
  poligoniQuasiUguali,
  type AnalisiTetto,
  type Coordinate,
  type FaldaTetto,
} from '@/lib/solar'

const MAX_FALDE_IN_MAPPA = 30

declare global {
  interface Window {
    google?: typeof google
  }
}

/** Host Map3D (Web Component) — tipi minimi. */
type Map3DHost = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number }
  range: number
  tilt: number
  heading: number
  mode: string
}

type Polygon3DHost = HTMLElement & {
  path: Array<{ lat: number; lng: number }>
}

type Maps3dLib = {
  Map3DElement: new (opts?: Record<string, unknown>) => Map3DHost
  Polygon3DElement: new (opts?: Record<string, unknown>) => Polygon3DHost
}

/** Carica Maps JavaScript (async + importLibrary). */
async function caricaMapsJs(apiKey: string): Promise<typeof google.maps> {
  if (typeof window === 'undefined') {
    throw new Error('Solo browser')
  }

  if (!document.querySelector('script[data-eco-maps]')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.dataset.ecoMaps = '1'
      script.async = true
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&v=weekly&loading=async`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Caricamento Maps fallito'))
      document.head.appendChild(script)
    })
  }

  const scadenza = Date.now() + 20_000
  while (!window.google?.maps?.importLibrary) {
    if (Date.now() > scadenza) {
      throw new Error('Maps non disponibile')
    }
    await new Promise((r) => setTimeout(r, 40))
  }

  await window.google.maps.importLibrary('maps')
  return window.google.maps
}

async function caricaMaps3d(): Promise<Maps3dLib> {
  if (!window.google?.maps?.importLibrary) {
    throw new Error('Maps non disponibile')
  }
  return (await window.google.maps.importLibrary('maps3d')) as Maps3dLib
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

/** Distanza camera ↔ tetto in base al bbox edificio. */
function rangeVista3dM(analisi: AnalisiTetto): number {
  if (!analisi.boundingBox) return 140
  const { sw, ne } = analisi.boundingBox
  const diag = metriFra(sw, ne)
  return Math.max(70, Math.min(450, diag * 1.7 + 40))
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

function stileSegmento(attivo: boolean): CSSProperties {
  return {
    background: attivo ? 'rgba(217, 164, 65, 0.2)' : 'transparent',
    color: attivo ? '#e8c765' : 'var(--testo-tenue)',
    boxShadow: attivo
      ? 'inset 0 0 0 1px rgba(232, 199, 101, 0.4)'
      : undefined,
  }
}

const stileBarraCtrl: CSSProperties = {
  borderColor: 'rgba(30, 51, 80, 0.95)',
  background: 'rgba(5, 10, 20, 0.82)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
}

export interface MappaTettoProps {
  analisi: AnalisiTetto
  poligoni: Readonly<Record<number, readonly Coordinate[]>>
  faldaSelezionata: number | null
  onSeleziona: (indice: number | null) => void
  onPoligonoCambiato: (indice: number, vertici: Coordinate[]) => void
  /** Click sulla mappa per riprendere Solar su un altro tetto. */
  scegliTetto: boolean
  onScegliTettoChange: (attivo: boolean) => void
  onPuntoTetto: (punto: Coordinate) => void
  ripresaInCorso?: boolean
}

export function MappaTetto({
  analisi,
  poligoni,
  faldaSelezionata,
  onSeleziona,
  onPoligonoCambiato,
  scegliTetto,
  onScegliTettoChange,
  onPuntoTetto,
  ripresaInCorso = false,
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
  const onPuntoTettoRef = useRef(onPuntoTetto)
  const scegliTettoRef = useRef(scegliTetto)
  const [errore, setErrore] = useState<string | null>(null)
  const [modo, setModo] = useState<'caricamento' | 'interattiva' | 'statica'>(
    'caricamento',
  )
  /** Inclinazione satellite (45°) + heading: poligoni restano editabili. */
  const [vista3d, setVista3d] = useState(false)
  const [headingExtra, setHeadingExtra] = useState(0)
  const [tipoMappa, setTipoMappa] = useState<'satellite' | 'roadmap'>('satellite')
  const [schermoIntero, setSchermoIntero] = useState(false)
  const corniceRef = useRef<HTMLDivElement>(null)
  const host3dRef = useRef<HTMLDivElement>(null)
  const map3dRef = useRef<Map3DHost | null>(null)
  const maps3dLibRef = useRef<Maps3dLib | null>(null)
  const range3dRef = useRef(140)

  const lat = analisi.location.latitude
  const lng = analisi.location.longitude
  const urlStatica = `/api/sviluppo/mappa?lat=${lat}&lng=${lng}&zoom=19`
  const urlEsterna =
    `https://www.google.com/maps/@${lat},${lng},19z/data=!3m1!1e3`

  useEffect(() => {
    onSelezionaRef.current = onSeleziona
    onPoligonoCambiatoRef.current = onPoligonoCambiato
    onPuntoTettoRef.current = onPuntoTetto
    scegliTettoRef.current = scegliTetto
  }, [onSeleziona, onPoligonoCambiato, onPuntoTetto, scegliTetto])

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
          heading: 0,
          disableDefaultUI: true,
          // Su mobile evita conflitti scroll pagina / mappa.
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
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

    const editingAttivo = faldaSelezionata != null && !scegliTetto

    for (const falda of mostrate) {
      const vertici = poligoni[falda.indice]
      if (!vertici || vertici.length < 3) continue

      const selezionata = faldaSelezionata === falda.indice
      const stile = scegliTetto
        ? {
            ...stileFalda(false, true),
            editable: false,
            clickable: false,
            fillOpacity: 0.08,
            strokeOpacity: 0.35,
          }
        : stileFalda(selezionata, editingAttivo)
      let poly = poligoniRef.current.get(falda.indice)
      if (!poly) {
        poly = new maps.Polygon({
          map: mappa,
          paths: aPath(vertici),
          ...stile,
        })
        poly.addListener('click', () => {
          if (scegliTettoRef.current) return
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
        poly.setOptions(stile)
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
      const markerOpts =
        editingAttivo || scegliTetto
          ? {
              clickable: false,
              opacity: scegliTetto ? 0.2 : selezionata ? 0.55 : 0.25,
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
          if (scegliTettoRef.current) return
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
  }, [analisi.falde, poligoni, faldaSelezionata, modo, scegliTetto])

  // Click mappa → nuovo tetto Solar.
  useEffect(() => {
    const mappa = mappaRef.current
    if (!mappa || modo !== 'interattiva' || !scegliTetto) return

    mappa.setOptions({ draggableCursor: 'crosshair' })
    const listener = mappa.addListener('click', (...args: unknown[]) => {
      if (ripresaInCorso) return
      const e = args[0] as { latLng?: { lat: () => number; lng: () => number } }
      const ll = e?.latLng
      if (!ll) return
      onPuntoTettoRef.current({
        latitude: ll.lat(),
        longitude: ll.lng(),
      })
    })

    return () => {
      listener.remove()
      mappa.setOptions({ draggableCursor: null })
    }
  }, [scegliTetto, modo, ripresaInCorso])

  // Vista 3D fotorealistica (Map3D): la vecchia imagery a 45° è deprecata.
  useEffect(() => {
    const host = host3dRef.current
    if (!vista3d || modo !== 'interattiva') {
      if (host) host.innerHTML = ''
      map3dRef.current = null
      return
    }

    let annullato = false

    ;(async () => {
      try {
        const lib = maps3dLibRef.current ?? (await caricaMaps3d())
        if (annullato || !host3dRef.current) return
        maps3dLibRef.current = lib

        const falda =
          faldaSelezionata != null
            ? analisi.falde.find((f) => f.indice === faldaSelezionata)
            : null
        const heading = ((falda?.azimuthDegrees ?? 0) + headingExtra) % 360
        const range = rangeVista3dM(analisi)
        range3dRef.current = range

        const hostAttuale = host3dRef.current
        hostAttuale.innerHTML = ''
        const map3d = new lib.Map3DElement({
          center: { lat, lng, altitude: 0 },
          range,
          tilt: 62,
          heading,
          mode: tipoMappa === 'roadmap' ? 'HYBRID' : 'SATELLITE',
          gestureHandling: 'GREEDY',
          defaultUIHidden: true,
        })
        map3d.style.width = '100%'
        map3d.style.height = '100%'
        map3d.style.border = '0'
        map3d.style.display = 'block'
        hostAttuale.append(map3d)
        map3dRef.current = map3d

        for (const f of faldeDaMostrare(analisi.falde)) {
          const vertici = poligoni[f.indice]
          if (!vertici || vertici.length < 3) continue
          const selezionata = faldaSelezionata === f.indice
          const poly = new lib.Polygon3DElement({
            strokeColor: selezionata ? '#e8c765cc' : '#5b9bd599',
            strokeWidth: selezionata ? 3 : 2,
            fillColor: selezionata ? '#d9a44166' : '#3f7fc440',
            drawsOccludedSegments: false,
          })
          poly.path = vertici.map((v) => ({
            lat: v.latitude,
            lng: v.longitude,
          }))
          map3d.append(poly)
        }
      } catch {
        if (!annullato) {
          setVista3d(false)
          setErrore(
            'Vista 3D non disponibile in questo browser.',
          )
        }
      }
    })()

    return () => {
      annullato = true
      if (host) host.innerHTML = ''
      map3dRef.current = null
    }
    // Ricrea solo al cambio edificio / ingresso 3D; camera e poligoni sotto.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync dedicati sotto
  }, [vista3d, modo, lat, lng])

  // Camera 3D: heading / mode senza ricreare la scena.
  useEffect(() => {
    const map3d = map3dRef.current
    if (!map3d || !vista3d) return
    const falda =
      faldaSelezionata != null
        ? analisi.falde.find((f) => f.indice === faldaSelezionata)
        : null
    map3d.heading = ((falda?.azimuthDegrees ?? 0) + headingExtra) % 360
    map3d.tilt = 62
    map3d.mode = tipoMappa === 'roadmap' ? 'HYBRID' : 'SATELLITE'
  }, [vista3d, faldaSelezionata, analisi.falde, headingExtra, tipoMappa])

  // Poligoni falde sulla scena 3D.
  useEffect(() => {
    const map3d = map3dRef.current
    const lib = maps3dLibRef.current
    if (!map3d || !lib || !vista3d) return

    for (const child of [...map3d.children]) {
      if (child.localName === 'gmp-polygon-3d') child.remove()
    }

    for (const f of faldeDaMostrare(analisi.falde)) {
      const vertici = poligoni[f.indice]
      if (!vertici || vertici.length < 3) continue
      const selezionata = faldaSelezionata === f.indice
      const poly = new lib.Polygon3DElement({
        strokeColor: selezionata ? '#e8c765cc' : '#5b9bd599',
        strokeWidth: selezionata ? 3 : 2,
        fillColor: selezionata ? '#d9a44166' : '#3f7fc440',
        drawsOccludedSegments: false,
      })
      poly.path = vertici.map((v) => ({
        lat: v.latitude,
        lng: v.longitude,
      }))
      map3d.append(poly)
    }
  }, [vista3d, analisi.falde, poligoni, faldaSelezionata])

  useEffect(() => {
    const mappa = mappaRef.current
    if (!mappa || modo !== 'interattiva' || vista3d) return
    mappa.setMapTypeId(tipoMappa)
  }, [tipoMappa, modo, vista3d])

  useEffect(() => {
    const onFs = () => {
      setSchermoIntero(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const zoomRelativo = (delta: number) => {
    if (vista3d && map3dRef.current) {
      const attuale = map3dRef.current.range || range3dRef.current
      const next = Math.max(
        40,
        Math.min(800, attuale * (delta > 0 ? 0.78 : 1.28)),
      )
      range3dRef.current = next
      map3dRef.current.range = next
      return
    }
    const mappa = mappaRef.current
    if (!mappa) return
    const z = mappa.getZoom() ?? 19
    mappa.setZoom(Math.max(14, Math.min(21, z + delta)))
  }

  const ruota = (delta: number) => {
    setHeadingExtra((h) => ((h + delta) % 360 + 360) % 360)
  }

  const toggleSchermoIntero = async () => {
    const el = corniceRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) await el.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      /* fullscreen non supportato / bloccato */
    }
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {modo === 'interattiva' ? (
            <button
              type="button"
              disabled={ripresaInCorso || vista3d}
              onClick={() => {
                if (vista3d) return
                onScegliTettoChange(!scegliTetto)
              }}
              title={
                vista3d
                  ? 'Torna a 2D per cambiare tetto'
                  : undefined
              }
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
              style={{
                borderColor: scegliTetto
                  ? 'rgba(232, 199, 101, 0.45)'
                  : 'var(--bordo)',
                background: scegliTetto
                  ? 'rgba(217, 164, 65, 0.16)'
                  : 'rgba(5,10,20,0.4)',
                color: scegliTetto ? '#e8c765' : 'var(--testo-tenue)',
              }}
            >
              {scegliTetto ? 'Annulla selezione' : 'Cambia tetto'}
            </button>
          ) : null}
          <a
            href={urlEsterna}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[rgba(232,199,101,0.35)]"
            style={{
              borderColor: 'var(--bordo)',
              background: 'rgba(5,10,20,0.4)',
              color: 'var(--color-eco-blue-300)',
            }}
          >
            Apri mappa esterna
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>

      <div
        ref={corniceRef}
        className="relative overflow-hidden rounded-xl border"
        style={{
          borderColor: 'var(--bordo)',
          minHeight: 240,
          background: '#050a14',
        }}
      >
        <div
          ref={contenitore}
          className={
            schermoIntero
              ? 'h-[100dvh] w-full'
              : 'h-[240px] w-full sm:h-[300px] lg:h-[340px]'
          }
          style={{
            display: modo === 'statica' || vista3d ? 'none' : 'block',
          }}
        />
        <div
          ref={host3dRef}
          className={
            schermoIntero
              ? 'h-[100dvh] w-full'
              : 'h-[240px] w-full sm:h-[300px] lg:h-[340px]'
          }
          style={{
            display: modo === 'interattiva' && vista3d ? 'block' : 'none',
            background: '#050a14',
          }}
        />

        {modo === 'interattiva' ? (
          <div className="pointer-events-none absolute inset-0 z-[2]">
            {/* Tipo mappa */}
            <div
              className="pointer-events-auto absolute top-3 left-3 flex gap-0.5 rounded-xl border p-1"
              style={stileBarraCtrl}
              role="group"
              aria-label="Tipo mappa"
            >
              {(
                [
                  ['satellite', 'Satellite'],
                  ['roadmap', 'Mappa'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTipoMappa(id)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition"
                  style={stileSegmento(tipoMappa === id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 2D/3D + fullscreen */}
            <div className="pointer-events-auto absolute top-3 right-3 flex items-center gap-2">
              <div
                className="flex gap-0.5 rounded-xl border p-1"
                style={stileBarraCtrl}
                role="group"
                aria-label="Proiezione"
              >
                {(
                  [
                    [false, '2D'],
                    [true, '3D'],
                  ] as const
                ).map(([attivo3d, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (attivo3d && scegliTetto) onScegliTettoChange(false)
                      setVista3d(attivo3d)
                      if (!attivo3d) setHeadingExtra(0)
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition"
                    style={stileSegmento(vista3d === attivo3d)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void toggleSchermoIntero()}
                title={schermoIntero ? 'Esci da tutto schermo' : 'Tutto schermo'}
                aria-label={
                  schermoIntero ? 'Esci da tutto schermo' : 'Tutto schermo'
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border text-xs transition hover:text-[#e8c765]"
                style={{ ...stileBarraCtrl, color: 'var(--testo-tenue)' }}
              >
                {schermoIntero ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Zoom + rotazione 3D */}
            <div className="pointer-events-auto absolute right-3 bottom-10 flex flex-col gap-2">
              {vista3d ? (
                <div
                  className="flex flex-col gap-0.5 rounded-xl border p-1"
                  style={stileBarraCtrl}
                >
                  <button
                    type="button"
                    onClick={() => ruota(-45)}
                    title="Ruota a sinistra"
                    aria-label="Ruota a sinistra"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs transition hover:text-[#e8c765]"
                    style={{ color: 'var(--testo-tenue)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M9 4H4v5M4.5 9A8 8 0 1 0 7 5.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => ruota(45)}
                    title="Ruota a destra"
                    aria-label="Ruota a destra"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs transition hover:text-[#e8c765]"
                    style={{ color: 'var(--testo-tenue)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M15 4h5v5M19.5 9A8 8 0 1 1 17 5.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ) : null}
              <div
                className="flex flex-col gap-0.5 rounded-xl border p-1"
                style={stileBarraCtrl}
              >
                <button
                  type="button"
                  onClick={() => zoomRelativo(1)}
                  title="Zoom avanti"
                  aria-label="Zoom avanti"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition hover:text-[#e8c765]"
                  style={{ color: 'var(--testo-tenue)' }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => zoomRelativo(-1)}
                  title="Zoom indietro"
                  aria-label="Zoom indietro"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition hover:text-[#e8c765]"
                  style={{ color: 'var(--testo-tenue)' }}
                >
                  −
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {modo === 'interattiva' && scegliTetto ? (
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-[3] max-w-[min(92%,22rem)] -translate-x-1/2 rounded-xl border px-3 py-2 text-center text-[11px] leading-snug"
            style={{
              ...stileBarraCtrl,
              color: '#e8c765',
            }}
          >
            {ripresaInCorso
              ? 'Ricerca edificio…'
              : 'Clicca sul tetto corretto (entro circa 200 m).'}
          </div>
        ) : null}

        {modo === 'caricamento' ? (
          <div
            className="absolute inset-0 z-[3] flex items-center justify-center text-sm"
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
            className="h-[240px] w-full object-cover sm:h-[300px] lg:h-[340px]"
          />
        ) : null}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Oro tenue = edificio. Blu = falde. La falda selezionata (oro) è
        editabile: i metri sui lati sono il rilievo del poligono. Inclinazione
        ed esposizione sono stime.
        {modo === 'interattiva'
          ? ' «Cambia tetto» (in 2D) ripunta un altro edificio entro circa 200 m. In vista 3D i poligoni restano visibili; per spostarli torna a 2D.'
          : null}
      </p>

      {errore && modo === 'statica' ? (
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {errore} Mappa interattiva non disponibile: usa la vista statica o
          riprova più tardi.
        </p>
      ) : null}
    </div>
  )
}
