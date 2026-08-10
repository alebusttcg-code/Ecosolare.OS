'use client'

import { useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge, Card, Vuoto } from '@/components/ui'
import { analizzaTetto } from '@/lib/actions/sviluppo'
import {
  areaPoligonoMetri2,
  etichettaAzimuth,
  formattaMetri,
  latiPoligono,
  perimetroPoligonoMetri,
  poligoniQuasiUguali,
  verticiDaRettangolo,
  type AnalisiTetto,
  type Coordinate,
  type FaldaTetto,
} from '@/lib/solar'
import { useAzioneServer } from '@/lib/use-azione-server'
import { MappaTetto } from './mappa-tetto'

function poligoniDaAnalisi(
  falde: readonly FaldaTetto[],
): Record<number, Coordinate[]> {
  const out: Record<number, Coordinate[]> = {}
  for (const f of falde) {
    if (f.boundingBox) {
      out[f.indice] = verticiDaRettangolo(f.boundingBox)
    }
  }
  return out
}

export function LaboratorioSolar({ configurato }: { configurato: boolean }) {
  const avvisa = useAvvisi()
  const { inCorso, esegui } = useAzioneServer()
  const [indirizzo, setIndirizzo] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [analisi, setAnalisi] = useState<AnalisiTetto | null>(null)
  const [poligoni, setPoligoni] = useState<Record<number, Coordinate[]>>({})
  const [faldaSelezionata, setFaldaSelezionata] = useState<number | null>(null)

  if (!configurato) {
    return (
      <Card>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Solar non configurato su questo ambiente. Imposta{' '}
          <code className="text-xs">GOOGLE_MAPS_API_KEY</code> con Geocoding API,
          Solar API, Maps JavaScript API e Maps Static API abilitate (vedi collaudo
          E2E).
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <form
          className="space-y-4"
          action={() => {
            setErrore(null)
            esegui(async () => {
              const esito = await analizzaTetto({ indirizzo })
              if (!esito.ok) {
                const msg =
                  esito.errors.indirizzo ??
                  esito.errors._ ??
                  'Analisi non riuscita.'
                setErrore(msg)
                setAnalisi(null)
                setPoligoni({})
                setFaldaSelezionata(null)
                return
              }
              setAnalisi(esito.data)
              setPoligoni(poligoniDaAnalisi(esito.data.falde))
              setFaldaSelezionata(null)
              avvisa('Tetto analizzato.')
            })
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
              Indirizzo dell’impianto
            </span>
            <input
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
              placeholder="Via, civico, CAP, comune…"
              required
              minLength={5}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-eco-blue-400"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            />
          </label>

          {errore ? <p className="text-sm text-eco-red-400">{errore}</p> : null}

          <button
            type="submit"
            disabled={inCorso || indirizzo.trim().length < 5}
            className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
              color: '#050a14',
            }}
          >
            {inCorso ? 'Analisi in corso…' : 'Analizza tetto'}
          </button>
        </form>
      </Card>

      {analisi ? (
        <Risultato
          analisi={analisi}
          poligoni={poligoni}
          faldaSelezionata={faldaSelezionata}
          onSeleziona={setFaldaSelezionata}
          onPoligonoCambiato={(indice, vertici) => {
            setPoligoni((prev) => ({ ...prev, [indice]: vertici }))
          }}
          onRipristina={(indice) => {
            const falda = analisi.falde.find((f) => f.indice === indice)
            if (!falda?.boundingBox) return
            setPoligoni((prev) => ({
              ...prev,
              [indice]: verticiDaRettangolo(falda.boundingBox!),
            }))
          }}
        />
      ) : null}
    </div>
  )
}

function Risultato({
  analisi,
  poligoni,
  faldaSelezionata,
  onSeleziona,
  onPoligonoCambiato,
  onRipristina,
}: {
  analisi: AnalisiTetto
  poligoni: Record<number, Coordinate[]>
  faldaSelezionata: number | null
  onSeleziona: (indice: number | null) => void
  onPoligonoCambiato: (indice: number, vertici: Coordinate[]) => void
  onRipristina: (indice: number) => void
}) {
  const falda =
    faldaSelezionata != null
      ? analisi.falde.find((f) => f.indice === faldaSelezionata) ?? null
      : null
  const verticiSelezionati =
    faldaSelezionata != null ? poligoni[faldaSelezionata] ?? null : null

  return (
    <div className="space-y-4">
      <Card title="Mappa">
        <MappaTetto
          analisi={analisi}
          poligoni={poligoni}
          faldaSelezionata={faldaSelezionata}
          onSeleziona={onSeleziona}
          onPoligonoCambiato={onPoligonoCambiato}
        />
      </Card>

      {falda && verticiSelezionati ? (
        <PannelloFalda
          falda={falda}
          vertici={verticiSelezionati}
          onDeseleziona={() => onSeleziona(null)}
          onRipristina={() => onRipristina(falda.indice)}
        />
      ) : (
        <Card>
          <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Seleziona una falda dalla mappa o dalla tabella per regolarne il
            perimetro e leggere le misure lato per lato.
          </p>
        </Card>
      )}

      <Card title="Edificio">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Indirizzo geocodificato
            </dt>
            <dd className="mt-0.5 font-medium">{analisi.formattedAddress}</dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Coordinate
            </dt>
            <dd className="mt-0.5 tabular-nums">
              {analisi.location.latitude.toFixed(5)},{' '}
              {analisi.location.longitude.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Qualità immagini
            </dt>
            <dd className="mt-0.5">
              {analisi.imageryQuality ? (
                <Badge
                  tone={
                    analisi.imageryQuality === 'HIGH'
                      ? 'positivo'
                      : analisi.imageryQuality === 'MEDIUM'
                        ? 'blu'
                        : 'neutro'
                  }
                >
                  {analisi.imageryQuality}
                </Badge>
              ) : (
                '—'
              )}
              {analisi.imageryDate ? (
                <span className="ml-2 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  ripresa {analisi.imageryDate}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Area tetto (stima)
            </dt>
            <dd className="mt-0.5 tabular-nums">
              {analisi.wholeRoofAreaMeters2 != null
                ? `${analisi.wholeRoofAreaMeters2.toFixed(1)} m²`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Max moduli (stima Google)
            </dt>
            <dd className="mt-0.5 tabular-nums">
              {analisi.maxArrayPanelsCount ?? '—'}
              {analisi.maxSunshineHoursPerYear != null ? (
                <span className="ml-2 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  · ~{Math.round(analisi.maxSunshineHoursPerYear)} h sole/anno
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Falde del tetto">
        {analisi.falde.length === 0 ? (
          <Vuoto messaggio="Nessuna falda rilevata per questo edificio." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr
                  className="border-b text-left text-xs"
                  style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
                >
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">Inclinazione</th>
                  <th className="pb-2 pr-3 font-medium">Esposizione</th>
                  <th className="pb-2 pr-3 text-right font-medium">Area Solar</th>
                  <th className="pb-2 pr-3 text-right font-medium">Area editata</th>
                  <th className="pb-2 text-right font-medium">Sole (rel.)</th>
                </tr>
              </thead>
              <tbody>
                {analisi.falde.map((f) => {
                  const vertici = poligoni[f.indice]
                  const areaEdit =
                    vertici && vertici.length >= 3
                      ? areaPoligonoMetri2(vertici)
                      : null
                  const seed = f.boundingBox
                    ? verticiDaRettangolo(f.boundingBox)
                    : null
                  const modificata =
                    vertici && seed
                      ? !poligoniQuasiUguali(vertici, seed)
                      : false
                  const attiva = faldaSelezionata === f.indice

                  return (
                    <tr
                      key={f.indice}
                      className="riga border-b last:border-0 cursor-pointer transition-colors"
                      style={{
                        borderColor: 'var(--bordo-tenue)',
                        background: attiva
                          ? 'rgba(217, 164, 65, 0.12)'
                          : undefined,
                      }}
                      onClick={() => onSeleziona(f.indice)}
                    >
                      <td className="py-2.5 pr-3 tabular-nums">
                        <span className="font-medium">{f.indice + 1}</span>
                        {modificata ? (
                          <span
                            className="ml-1.5 text-[10px] uppercase tracking-wide"
                            style={{ color: '#e8c765' }}
                          >
                            edit
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">
                        {f.pitchDegrees.toFixed(1)}°
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">
                          {etichettaAzimuth(f.azimuthDegrees)}
                        </span>
                        <span
                          className="ml-2 text-xs tabular-nums"
                          style={{ color: 'var(--testo-tenue)' }}
                        >
                          {f.azimuthDegrees.toFixed(0)}°
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {f.areaMeters2.toFixed(1)} m²
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {areaEdit != null ? `${areaEdit.toFixed(1)} m²` : '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {f.sunshineMedio != null ? f.sunshineMedio.toFixed(0) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
          Dati da Google Solar API. Inclinazione = pitch; esposizione = azimuth (0° =
          Nord). Area editata = poligono regolato in mappa (proiezione a terra). I
          calcoli EcoSolare (moduli, kWp, benefici) arriveranno negli step successivi.
        </p>
      </Card>
    </div>
  )
}

function PannelloFalda({
  falda,
  vertici,
  onDeseleziona,
  onRipristina,
}: {
  falda: FaldaTetto
  vertici: readonly Coordinate[]
  onDeseleziona: () => void
  onRipristina: () => void
}) {
  const lati = useMemo(() => latiPoligono(vertici), [vertici])
  const areaEditata = useMemo(() => areaPoligonoMetri2(vertici), [vertici])
  const perimetro = useMemo(() => perimetroPoligonoMetri(vertici), [vertici])
  const seed = falda.boundingBox
    ? verticiDaRettangolo(falda.boundingBox)
    : null
  const modificata = seed ? !poligoniQuasiUguali(vertici, seed) : false

  return (
    <Card title={`Falda ${falda.indice + 1}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Inclinazione (Solar)
            </dt>
            <dd className="mt-0.5 tabular-nums font-medium">
              {falda.pitchDegrees.toFixed(1)}°
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Esposizione (Solar)
            </dt>
            <dd className="mt-0.5">
              <span className="font-medium">
                {etichettaAzimuth(falda.azimuthDegrees)}
              </span>
              <span
                className="ml-2 text-xs tabular-nums"
                style={{ color: 'var(--testo-tenue)' }}
              >
                {falda.azimuthDegrees.toFixed(0)}°
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Area Solar
            </dt>
            <dd className="mt-0.5 tabular-nums">
              {falda.areaMeters2.toFixed(1)} m²
              {falda.groundAreaMeters2 != null ? (
                <span
                  className="ml-2 text-xs"
                  style={{ color: 'var(--testo-tenue)' }}
                >
                  · {falda.groundAreaMeters2.toFixed(1)} m² a terra
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Area / perimetro editati
            </dt>
            <dd className="mt-0.5 tabular-nums font-medium">
              {areaEditata.toFixed(1)} m²
              <span
                className="ml-2 text-xs font-normal"
                style={{ color: 'var(--testo-tenue)' }}
              >
                · {formattaMetri(perimetro)} peri.
              </span>
              {modificata ? (
                <span className="ml-2 inline-block align-middle">
                  <Badge tone="blu">modificata</Badge>
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onRipristina}
            disabled={!modificata}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            style={{ borderColor: 'var(--bordo)', color: 'var(--testo)' }}
          >
            Ripristina bbox Solar
          </button>
          <button
            type="button"
            onClick={onDeseleziona}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
          >
            Deseleziona
          </button>
        </div>
      </div>

      {lati.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {lati.map((lato, i) => (
            <li
              key={`${i}-${lato.etichetta}`}
              className="rounded-md border px-2.5 py-1 text-xs tabular-nums"
              style={{
                borderColor: 'rgba(232, 199, 101, 0.35)',
                background: 'rgba(217, 164, 65, 0.08)',
                color: '#e8c765',
              }}
            >
              Lato {i + 1}: {lato.etichetta}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
