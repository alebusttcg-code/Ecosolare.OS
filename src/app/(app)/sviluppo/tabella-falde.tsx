'use client'

import { Badge, Card, Vuoto } from '@/components/ui'
import {
  areaPoligonoMetri2,
  etichettaAzimuth,
  poligoniQuasiUguali,
  verticiDaRettangolo,
  type AnalisiTetto,
  type Coordinate,
  type FaldaTetto,
} from '@/lib/solar'

/** Card di riepilogo dell'edificio analizzato (indirizzo, qualità immagini,
 * area e stima moduli). Sola lettura: non tocca lo stato del laboratorio. */
export function CardEdificio({ analisi }: { analisi: AnalisiTetto }) {
  return (
    <Card title="Edificio">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Indirizzo riconosciuto
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
            Max moduli (stima)
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
  )
}

/** Tabella delle falde rilevate: riga per falda (inclinazione, esposizione, aree,
 * sole), selezione, eliminazione dalla sessione e ripristino. */
export function TabellaFalde({
  faldeVisibili,
  totaleFalde,
  poligoni,
  faldaSelezionata,
  faldeRimosse,
  trascinamentoModuli,
  onSeleziona,
  onEliminaFalda,
  onRipristinaFaldeRimosse,
}: {
  faldeVisibili: readonly FaldaTetto[]
  totaleFalde: number
  poligoni: Record<number, Coordinate[]>
  faldaSelezionata: number | null
  faldeRimosse: ReadonlySet<number>
  trascinamentoModuli: boolean
  onSeleziona: (indice: number) => void
  onEliminaFalda: (indice: number) => void
  onRipristinaFaldeRimosse: () => void
}) {
  return (
    <Card title="Falde del tetto">
      {trascinamentoModuli ? (
        <p className="mb-3 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Rilascia i moduli prima di cambiare falda.
        </p>
      ) : null}
      {faldeVisibili.length === 0 ? (
        <Vuoto
          messaggio={
            totaleFalde === 0
              ? 'Nessuna falda rilevata per questo edificio.'
              : 'Hai eliminato tutte le falde. Ripristinale per continuare.'
          }
        />
      ) : (
        <div
          className="overflow-x-auto"
          style={{ opacity: trascinamentoModuli ? 0.55 : 1 }}
        >
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr
                className="border-b text-left text-xs"
                style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
              >
                <th className="pb-2 pr-3 font-medium">#</th>
                <th className="pb-2 pr-3 font-medium">Inclinazione</th>
                <th className="pb-2 pr-3 font-medium">Esposizione</th>
                <th className="pb-2 pr-3 text-right font-medium">Area rilevata</th>
                <th className="pb-2 pr-3 text-right font-medium">Area editata</th>
                <th className="pb-2 pr-3 text-right font-medium">Sole (rel.)</th>
                <th className="pb-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {faldeVisibili.map((f) => {
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
                    className="riga border-b last:border-0 transition-colors"
                    style={{
                      borderColor: 'var(--bordo-tenue)',
                      background: attiva
                        ? 'rgba(217, 164, 65, 0.12)'
                        : undefined,
                      cursor: trascinamentoModuli
                        ? 'not-allowed'
                        : 'pointer',
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
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {f.sunshineMedio != null ? f.sunshineMedio.toFixed(0) : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium hover:underline"
                        style={{ color: 'var(--testo-fioco)' }}
                        title="Rimuovi dal lavoro"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEliminaFalda(f.indice)
                        }}
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {faldeRimosse.size > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: 'var(--bordo-tenue)',
            background: 'rgba(5,10,20,0.35)',
            color: 'var(--testo-tenue)',
          }}
        >
          <span>
            {faldeRimosse.size === 1
              ? '1 falda eliminata da questa sessione'
              : `${faldeRimosse.size} falde eliminate da questa sessione`}
            {totaleFalde > 0
              ? ` · restano ${faldeVisibili.length} su ${totaleFalde}`
              : null}
          </span>
          <button
            type="button"
            onClick={onRipristinaFaldeRimosse}
            className="font-medium text-eco-blue-300 hover:underline"
          >
            Ripristina eliminate
          </button>
        </div>
      ) : null}
      <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Inclinazione ed esposizione sono stime sul tetto rilevato. L’area
        editata è quella del poligono regolato in mappa. Eliminare una falda
        la toglie solo da questa sessione di lavoro.
      </p>
    </Card>
  )
}
