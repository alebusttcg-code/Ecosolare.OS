'use client'

import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge, Card, Vuoto } from '@/components/ui'
import { analizzaTetto } from '@/lib/actions/sviluppo'
import { etichettaAzimuth, type AnalisiTetto } from '@/lib/solar'
import { useAzioneServer } from '@/lib/use-azione-server'
import { MappaTetto } from './mappa-tetto'

export function LaboratorioSolar({ configurato }: { configurato: boolean }) {
  const avvisa = useAvvisi()
  const { inCorso, esegui } = useAzioneServer()
  const [indirizzo, setIndirizzo] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [analisi, setAnalisi] = useState<AnalisiTetto | null>(null)

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
                return
              }
              setAnalisi(esito.data)
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

      {analisi ? <Risultato analisi={analisi} /> : null}
    </div>
  )
}

function Risultato({ analisi }: { analisi: AnalisiTetto }) {
  return (
    <div className="space-y-4">
      <Card title="Mappa">
        <MappaTetto analisi={analisi} />
      </Card>

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
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr
                  className="border-b text-left text-xs"
                  style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
                >
                  <th className="pb-2 pr-3 font-medium">#</th>
                  <th className="pb-2 pr-3 font-medium">Inclinazione</th>
                  <th className="pb-2 pr-3 font-medium">Esposizione</th>
                  <th className="pb-2 pr-3 text-right font-medium">Area</th>
                  <th className="pb-2 text-right font-medium">Sole (rel.)</th>
                </tr>
              </thead>
              <tbody>
                {analisi.falde.map((f) => (
                  <tr
                    key={f.indice}
                    className="riga border-b last:border-0"
                    style={{ borderColor: 'var(--bordo-tenue)' }}
                  >
                    <td className="py-2.5 pr-3 tabular-nums">{f.indice + 1}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {f.pitchDegrees.toFixed(1)}°
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{etichettaAzimuth(f.azimuthDegrees)}</span>
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
                    <td className="py-2.5 text-right tabular-nums">
                      {f.sunshineMedio != null ? f.sunshineMedio.toFixed(0) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
          Dati da Google Solar API. Inclinazione = pitch; esposizione = azimuth (0° =
          Nord). I calcoli EcoSolare (moduli, kWp, benefici) arriveranno negli step
          successivi.
        </p>
      </Card>
    </div>
  )
}
