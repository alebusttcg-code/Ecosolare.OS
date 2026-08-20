'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge, Card } from '@/components/ui'
import { salvaStudioTetto } from '@/lib/actions/site-studies'
import { analizzaTetto, analizzaTettoAlPunto, caricaDsmEdificio } from '@/lib/actions/sviluppo'
import { bilanciaEnergia } from '@/lib/domain/bilancio-energia'
import {
  bollettaConFvAnnuacents,
  costoEnergiaCents,
} from '@/lib/domain/economia-fv'
import { formattaImporto } from '@/lib/domain/money'
import {
  contaModuli,
  kWpDaLayouts,
  layoutsAttivi,
  stimaProduzioneDaStudio,
  type LayoutStudioFalda,
} from '@/lib/domain/studio-tetto'
import {
  areaPoligonoMetri2,
  etichettaAzimuth,
  formattaMetri,
  latiPoligono,
  meshFaldaDaDsm,
  perimetroPoligonoMetri,
  poligoniQuasiUguali,
  profiloSezioneDsm,
  verticiDaRettangolo,
  type AnalisiTetto,
  type Coordinate,
  type FaldaTetto,
  type GrigliaDsm,
} from '@/lib/solar'
import { useAzioneServer } from '@/lib/use-azione-server'
import { EditorModuli, type LayoutModuliCorrente } from './editor-moduli'
import { catturaAnteprimeTetto } from './anteprima-moduli'
import { CampoIndirizzo } from './campo-indirizzo'
import { MappaTetto } from './mappa-tetto'
import { SezioneFalda } from './sezione-falda'
import { CardEdificio, TabellaFalde } from './tabella-falde'
import { Vista3dFalda } from './vista-3d-falda'

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

export type ContestoCrmStudio = {
  readonly opportunityId: string
  readonly studyId?: string
  readonly indirizzoProposto?: string
  readonly titoloLead?: string
  readonly snapshotIniziale?: import('@/lib/domain/studio-tetto').SnapshotStudioTetto
}


/**
 * Numero da un campo facoltativo, o `null` se vuoto.
 *
 * Distinguere «vuoto» da «zero» conta: uno zero inviato al posto di un campo
 * non compilato diventerebbe un consumo di gas dichiarato pari a zero, cioè un
 * dato falso invece di un dato assente.
 */
function numeroOpzionale(grezzo: string): number | null {
  const pulito = grezzo.trim().replace(',', '.')
  if (pulito === '') return null
  const n = Number.parseFloat(pulito)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function LaboratorioSolar({
  configurato,
  contestoCrm,
  ritorno = null,
}: {
  configurato: boolean
  contestoCrm?: ContestoCrmStudio | null
  /** Path interno sicuro (`?da=`) dopo salvataggio studio completo. */
  ritorno?: string | null
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const { inCorso, esegui } = useAzioneServer()
  const iniziale = contestoCrm?.snapshotIniziale
  const [indirizzo, setIndirizzo] = useState(
    iniziale?.analisi.formattedAddress ?? contestoCrm?.indirizzoProposto ?? '',
  )
  const [errore, setErrore] = useState<string | null>(null)
  const [analisi, setAnalisi] = useState<AnalisiTetto | null>(
    iniziale?.analisi ?? null,
  )
  const [poligoni, setPoligoni] = useState<Record<number, Coordinate[]>>(() => {
    if (!iniziale?.poligoni) return {}
    const out: Record<number, Coordinate[]> = {}
    for (const [k, v] of Object.entries(iniziale.poligoni)) {
      out[Number(k)] = [...v]
    }
    return out
  })
  const [faldaSelezionata, setFaldaSelezionata] = useState<number | null>(() => {
    const layouts = layoutsAttivi(iniziale)
    return layouts[0]?.faldaIndice ?? null
  })
  /** Indici Solar esclusi dall’editor (solo sessione UI). */
  const [faldeRimosse, setFaldeRimosse] = useState<ReadonlySet<number>>(
    () => new Set(iniziale?.faldeRimosse ?? []),
  )
  const [scegliTetto, setScegliTetto] = useState(false)
  /** Layout moduli per falda: si accumulano cambiando falda nell’editor. */
  const [layoutsPerFalda, setLayoutsPerFalda] = useState<
    Record<number, LayoutModuliCorrente>
  >(() => {
    const out: Record<number, LayoutModuliCorrente> = {}
    for (const L of layoutsAttivi(iniziale)) {
      out[L.faldaIndice] = {
        faldaIndice: L.faldaIndice,
        formatoId: L.formatoId,
        wattPicco: L.wattPicco,
        quantitaRichiesta: L.quantitaRichiesta,
        landscape: L.landscape,
        moduli: L.moduli,
        kWp: (L.moduli.length * L.wattPicco) / 1000,
      }
    }
    return out
  })

  const layoutsLista = useMemo((): LayoutStudioFalda[] => {
    return Object.values(layoutsPerFalda)
      .filter(
        (l) => l.moduli.length > 0 && !faldeRimosse.has(l.faldaIndice),
      )
      .map((layout) => ({
        faldaIndice: layout.faldaIndice,
        formatoId: layout.formatoId,
        wattPicco: layout.wattPicco,
        quantitaRichiesta: layout.quantitaRichiesta,
        landscape: layout.landscape,
        moduli: layout.moduli,
      }))
      .sort((a, b) => a.faldaIndice - b.faldaIndice)
  }, [layoutsPerFalda, faldeRimosse])

  const onLayoutChangeFalda = useCallback((layout: LayoutModuliCorrente | null) => {
    // null = rumore (unmount/deselect): non cancellare nulla.
    // Upsert solo con moduli; clear esplicito = moduli vuoti + faldaIndice noto.
    if (!layout) return
    setLayoutsPerFalda((prev) => {
      if (layout.moduli.length === 0) {
        if (!(layout.faldaIndice in prev)) return prev
        const next = { ...prev }
        delete next[layout.faldaIndice]
        return next
      }
      return { ...prev, [layout.faldaIndice]: layout }
    })
  }, [])
  const [consumoAnnuoKwh, setConsumoAnnuoKwh] = useState(
    iniziale ? String(iniziale.consumoAnnuoKwh) : '8000',
  )
  const [tariffaImport, setTariffaImport] = useState(
    iniziale ? String(iniziale.tariffaImportEurKwh) : '0,30',
  )
  const [tariffaExport, setTariffaExport] = useState(
    iniziale ? String(iniziale.tariffaExportEurKwh) : '0,10',
  )
  /*
   * Gas dell'ultimo anno, dalla bolletta del cliente. È da qui che si ricava
   * il fabbisogno termico quando il preventivo comprende una pompa di calore:
   * è un dato che il cliente ha in mano e che l'anno scorso ha davvero
   * bruciato, mentre ogni stima da metri quadri e zona climatica sbaglia
   * facilmente del trenta per cento.
   */
  const [consumoGasSmc, setConsumoGasSmc] = useState(
    iniziale?.consumoGasAnnuoSmc != null ? String(iniziale.consumoGasAnnuoSmc) : '',
  )
  const [gasCucinaSmc, setGasCucinaSmc] = useState(
    iniziale?.gasNonSostituitoSmc != null ? String(iniziale.gasNonSostituitoSmc) : '',
  )
  const [autoconsumoPct, setAutoconsumoPct] = useState(
    iniziale?.frazioneAutoconsumo != null
      ? String(Math.round(iniziale.frazioneAutoconsumo * 100))
      : '40',
  )
  const [focusTettoX, setFocusTettoX] = useState(
    String(iniziale?.focusTettoXPct ?? 50),
  )
  const [focusTettoY, setFocusTettoY] = useState(
    String(iniziale?.focusTettoYPct ?? 50),
  )
  const [studyId, setStudyId] = useState<string | undefined>(contestoCrm?.studyId)

  const anteprimaEnergia = useMemo(() => {
    const consumo = Number.parseFloat(consumoAnnuoKwh.replace(',', '.'))
    const tImport = Number.parseFloat(tariffaImport.replace(',', '.'))
    const tExport = Number.parseFloat(tariffaExport.replace(',', '.'))
    const fPct = Number.parseFloat(autoconsumoPct.replace(',', '.'))
    if (
      layoutsLista.length === 0 ||
      !analisi ||
      !Number.isFinite(consumo) ||
      consumo < 0 ||
      !Number.isFinite(tImport) ||
      !Number.isFinite(tExport) ||
      !Number.isFinite(fPct)
    ) {
      return null
    }
    const produzione = stimaProduzioneDaStudio({
      analisi,
      faldeRimosse: [...faldeRimosse],
      layouts: layoutsLista,
    })
    if (!(produzione > 0)) return null
    const bilancio = bilanciaEnergia({
      produzioneKwh: produzione,
      consumoKwh: consumo,
      frazioneAutoconsumo: fPct / 100,
    })
    const attuale = costoEnergiaCents(consumo, tImport)
    const conFv = bollettaConFvAnnuacents(bilancio, tImport, tExport)
    const risparmio = attuale - conFv
    return {
      produzione,
      moduli: contaModuli(layoutsLista),
      kWp: kWpDaLayouts(layoutsLista),
      nFalde: layoutsLista.length,
      bilancio,
      bollettaAttualeMensile: formattaImporto(Math.round(attuale / 12)),
      bollettaConFvMensile: formattaImporto(Math.round(conFv / 12)),
      risparmioAnnuo: formattaImporto(risparmio),
    }
  }, [
    analisi,
    autoconsumoPct,
    consumoAnnuoKwh,
    faldeRimosse,
    layoutsLista,
    tariffaExport,
    tariffaImport,
  ])

  if (!configurato) {
    return (
      <Card>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Analisi tetto non disponibile su questo ambiente. Contatta
          l’amministratore di sistema.
        </p>
      </Card>
    )
  }

  const salvaStudio = (completa: boolean) => {
    if (!contestoCrm?.opportunityId || !analisi) return
    setErrore(null)
    esegui(async () => {
      const consumo = Number.parseFloat(consumoAnnuoKwh.replace(',', '.'))
      const tImport = Number.parseFloat(tariffaImport.replace(',', '.'))
      const tExport = Number.parseFloat(tariffaExport.replace(',', '.'))
      const fPct = Number.parseFloat(autoconsumoPct.replace(',', '.'))
      const focusX = Number.parseFloat(focusTettoX.replace(',', '.'))
      const focusY = Number.parseFloat(focusTettoY.replace(',', '.'))
      if (!Number.isFinite(consumo) || consumo < 0) {
        setErrore('Indica il consumo annuo in kWh (0 se impianto aggiuntivo).')
        return
      }
      if (!Number.isFinite(tImport) || tImport < 0 || tImport > 5) {
        setErrore('Tariffa di prelievo non valida (€/kWh).')
        return
      }
      if (!Number.isFinite(tExport) || tExport < 0 || tExport > 5) {
        setErrore('Tariffa di cessione / RID non valida (€/kWh).')
        return
      }
      if (!Number.isFinite(fPct) || fPct < 0 || fPct > 100) {
        setErrore('Autoconsumo atteso: indicare una percentuale tra 0 e 100.')
        return
      }
      if (!Number.isFinite(focusX) || focusX < 0 || focusX > 100 || !Number.isFinite(focusY) || focusY < 0 || focusY > 100) {
        setErrore('Punto focale del tetto: indicare valori tra 0 e 100.')
        return
      }
      const poligoniJson: Record<string, Coordinate[]> = {}
      for (const [k, v] of Object.entries(poligoni)) {
        if (!faldeRimosse.has(Number(k))) poligoniJson[k] = v
      }
      const layouts = layoutsLista.map((L) => ({
        faldaIndice: L.faldaIndice,
        formatoId: L.formatoId,
        wattPicco: L.wattPicco,
        quantitaRichiesta: L.quantitaRichiesta,
        landscape: L.landscape,
        moduli: L.moduli.map((m) => ({
          angoli: [
            m.angoli[0],
            m.angoli[1],
            m.angoli[2],
            m.angoli[3],
          ] as [
            (typeof m.angoli)[0],
            (typeof m.angoli)[1],
            (typeof m.angoli)[2],
            (typeof m.angoli)[3],
          ],
          centro: m.centro,
          rotazioneDegrees: m.rotazioneDegrees,
        })),
      }))
      const produzione = stimaProduzioneDaStudio({
        analisi,
        faldeRimosse: [...faldeRimosse],
        layouts,
      })
      let anteprimaModuliDataUri: string | undefined
      let anteprimaTettoDataUri: string | undefined
      if (contaModuli(layouts) > 0) {
        try {
          const anteprime = await catturaAnteprimeTetto({
            poligoni: poligoniJson,
            layouts,
          })
          if (anteprime) {
            anteprimaTettoDataUri = anteprime.senzaModuliDataUri
            anteprimaModuliDataUri = anteprime.conModuliDataUri
          }
        } catch {
          // Il salvataggio non dipende dall’anteprima PDF.
        }
      }
      const esito = await salvaStudioTetto({
        studyId,
        opportunityId: contestoCrm.opportunityId,
        title: contestoCrm.titoloLead
          ? `Studio — ${contestoCrm.titoloLead}`
          : 'Studio tetto',
        completa,
        snapshot: {
          analisi,
          poligoni: poligoniJson,
          faldeRimosse: [...faldeRimosse],
          layouts,
          consumoAnnuoKwh: consumo,
          produzioneAnnuakWh: produzione,
          tariffaImportEurKwh: tImport,
          tariffaExportEurKwh: tExport,
          frazioneAutoconsumo: fPct / 100,
          focusTettoXPct: focusX,
          focusTettoYPct: focusY,
          // Campi facoltativi: si inviano solo se compilati, così un preventivo
          // senza pompa di calore non porta con sé uno zero che sembra un dato.
          ...(numeroOpzionale(consumoGasSmc) != null
            ? { consumoGasAnnuoSmc: numeroOpzionale(consumoGasSmc)! }
            : {}),
          ...(numeroOpzionale(gasCucinaSmc) != null
            ? { gasNonSostituitoSmc: numeroOpzionale(gasCucinaSmc)! }
            : {}),
          ...(anteprimaModuliDataUri ? { anteprimaModuliDataUri } : {}),
          ...(anteprimaTettoDataUri ? { anteprimaTettoDataUri } : {}),
        },
      })
      if (!esito.ok) {
        setErrore(esito.errors._ ?? 'Salvataggio non riuscito.')
        return
      }
      setStudyId(esito.data.studyId)
      if (esito.data.status === 'completo') {
        avvisa(
          ritorno
            ? 'Studio completo: torni al sopralluogo con la geometria aggiornata.'
            : 'Studio completo: puoi creare il preventivo dal lead.',
        )
        if (ritorno) {
          router.push(ritorno)
          router.refresh()
        }
        return
      }
      avvisa('Bozza studio salvata.')
    })
  }

  return (
    <div className="space-y-6">
      {contestoCrm ? (
        <Card>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
            Studio collegato al lead
            {contestoCrm.titoloLead ? (
              <>
                {' '}
                <strong style={{ color: 'var(--testo)' }}>{contestoCrm.titoloLead}</strong>
              </>
            ) : null}
            . Analizza il tetto, posiziona i moduli e salva come{' '}
            <strong style={{ color: 'var(--testo)' }}>completo</strong>
            {ritorno?.startsWith('/agenda/')
              ? ' per tornare al sopralluogo con la geometria e sbloccare la chiusura.'
              : ' per sbloccare il preventivo.'}
          </p>
        </Card>
      ) : null}

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
                setFaldeRimosse(new Set())
                setLayoutsPerFalda({})
                return
              }
              setAnalisi(esito.data)
              setPoligoni(poligoniDaAnalisi(esito.data.falde))
              setFaldaSelezionata(null)
              setFaldeRimosse(new Set())
              setLayoutsPerFalda({})
              setScegliTetto(false)
              avvisa('Tetto analizzato. Preparazione quote in corso…')
            })
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
              Indirizzo dell’impianto
            </span>
            <CampoIndirizzo
              value={indirizzo}
              onChange={setIndirizzo}
              disabled={inCorso}
            />
            <span className="mt-1.5 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
              Suggerimenti mentre digiti; puoi anche scrivere l’indirizzo a mano.
            </span>
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

      {analisi && contestoCrm ? (
        <Card title="Salva studio per il preventivo">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--testo-fioco)' }}
              >
                Consumo annuo (kWh)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={consumoAnnuoKwh}
                onChange={(e) => setConsumoAnnuoKwh(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'rgba(5,10,20,0.55)',
                  borderColor: 'var(--bordo)',
                }}
              />
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                0 = impianto aggiuntivo (tutta l’energia in rete).
              </span>
            </label>
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--testo-fioco)' }}
              >
                Gas ultimo anno (Smc)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={consumoGasSmc}
                onChange={(e) => setConsumoGasSmc(e.target.value)}
                placeholder="dalla bolletta"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'rgba(5,10,20,0.55)',
                  borderColor: 'var(--bordo)',
                }}
              />
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                Serve solo con la pompa di calore: da qui esce il fabbisogno termico.
              </span>
            </label>
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--testo-fioco)' }}
              >
                Di cui cucina (Smc)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={gasCucinaSmc}
                onChange={(e) => setGasCucinaSmc(e.target.value)}
                placeholder="es. 120"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'rgba(5,10,20,0.55)',
                  borderColor: 'var(--bordo)',
                }}
              />
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                Resta a gas e non viene sostituito.
              </span>
            </label>
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--testo-fioco)' }}
              >
                Tariffa prelievo (€/kWh)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={tariffaImport}
                onChange={(e) => setTariffaImport(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'rgba(5,10,20,0.55)',
                  borderColor: 'var(--bordo)',
                }}
              />
            </label>
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--testo-fioco)' }}
              >
                Tariffa cessione / RID (€/kWh)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={tariffaExport}
                onChange={(e) => setTariffaExport(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'rgba(5,10,20,0.55)',
                  borderColor: 'var(--bordo)',
                }}
              />
            </label>
            <label className="block">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--testo-fioco)' }}
              >
                Autoconsumo atteso (%)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={autoconsumoPct}
                onChange={(e) => setAutoconsumoPct(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'rgba(5,10,20,0.55)',
                  borderColor: 'var(--bordo)',
                }}
              />
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                Quota della produzione usata in casa (poi limitata dal consumo).
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                Fuoco foto tetto orizzontale (%)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={focusTettoX}
                onChange={(e) => setFocusTettoX(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                0 = sinistra, 50 = centro, 100 = destra nel PDF.
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-fioco)' }}>
                Fuoco foto tetto verticale (%)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={focusTettoY}
                onChange={(e) => setFocusTettoY(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              />
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                0 = alto, 50 = centro, 100 = basso nel PDF.
              </span>
            </label>
          </div>
          <div className="mt-4 text-sm tabular-nums" style={{ color: 'var(--testo-tenue)' }}>
            {layoutsLista.length > 0 && analisi ? (
              <>
                {contaModuli(layoutsLista)} moduli ·{' '}
                {kWpDaLayouts(layoutsLista).toFixed(2)} kWp ·{' '}
                {layoutsLista.length} falda
                {layoutsLista.length === 1 ? '' : 'e'} (
                {layoutsLista
                  .map((l) => `F${l.faldaIndice + 1}:${l.moduli.length}`)
                  .join(', ')}
                ) · ~{' '}
                {stimaProduzioneDaStudio({
                  analisi,
                  faldeRimosse: [...faldeRimosse],
                  layouts: layoutsLista,
                }).toLocaleString('it-IT')}{' '}
                kWh/anno (somma per falda: esposizione, inclinazione, zona)
              </>
            ) : (
              'Posiziona i moduli su una o più falde per stimare kWp e produzione.'
            )}
          </div>
          {anteprimaEnergia ? (
            <div
              className="mt-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-3"
              style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.35)' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--oro)' }}>
                  Bolletta attuale / mese
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--testo)' }}>
                  {anteprimaEnergia.bollettaAttualeMensile}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--oro)' }}>
                  Bolletta con FV / mese
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--testo)' }}>
                  {anteprimaEnergia.bollettaConFvMensile}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--oro)' }}>
                  Risparmio anno 1
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--testo)' }}>
                  {anteprimaEnergia.risparmioAnnuo}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
                  Autoconsumo {anteprimaEnergia.bilancio.autoconsumoKwh.toLocaleString('it-IT')}{' '}
                  kWh · export{' '}
                  {anteprimaEnergia.bilancio.exportKwh.toLocaleString('it-IT')} kWh · da rete{' '}
                  {anteprimaEnergia.bilancio.daReteKwh.toLocaleString('it-IT')} kWh
                </p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={inCorso || !analisi}
              onClick={() => salvaStudio(false)}
              className="rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              Salva bozza
            </button>
            <button
              type="button"
              disabled={inCorso || !analisi || layoutsLista.length === 0}
              onClick={() => salvaStudio(true)}
              className="bottone-oro rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
                color: '#050a14',
              }}
            >
              Salva studio completo
            </button>
            {studyId ? (
              <a
                href={`/lead/${contestoCrm.opportunityId}`}
                className="self-center text-xs text-eco-blue-300 hover:underline"
              >
                Torna al lead →
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      {analisi ? (
        <Risultato
          analisi={analisi}
          poligoni={poligoni}
          faldaSelezionata={faldaSelezionata}
          faldeRimosse={faldeRimosse}
          scegliTetto={scegliTetto}
          ripresaInCorso={inCorso}
          onLayoutChange={onLayoutChangeFalda}
          layoutInizialeFalda={
            faldaSelezionata != null
              ? (layoutsPerFalda[faldaSelezionata] ?? null)
              : null
          }
          onSeleziona={setFaldaSelezionata}
          onScegliTettoChange={setScegliTetto}
          onPuntoTetto={(punto) => {
            setErrore(null)
            setScegliTetto(false)
            esegui(async () => {
              const esito = await analizzaTettoAlPunto({
                latitude: punto.latitude,
                longitude: punto.longitude,
                formattedAddress: analisi.formattedAddress,
              })
              if (!esito.ok) {
                const msg = esito.errors._ ?? 'Cambio tetto non riuscito.'
                setErrore(msg)
                avvisa(msg)
                setScegliTetto(true)
                return
              }
              setAnalisi(esito.data)
              setPoligoni(poligoniDaAnalisi(esito.data.falde))
              setFaldaSelezionata(null)
              setFaldeRimosse(new Set())
              setLayoutsPerFalda({})
              avvisa('Tetto aggiornato. Preparazione quote in corso…')
            })
          }}
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
          onEliminaFalda={(indice) => {
            setFaldeRimosse((prev) => new Set([...prev, indice]))
            setPoligoni((prev) => {
              const next = { ...prev }
              delete next[indice]
              return next
            })
            // Layout moduli restano in memoria sessione: al ripristino tornano.
            setFaldaSelezionata((sel) => (sel === indice ? null : sel))
          }}
          onRipristinaFaldeRimosse={() => {
            const daRipristinare = analisi.falde.filter((f) =>
              faldeRimosse.has(f.indice),
            )
            setPoligoni((prev) => {
              const next = { ...prev }
              for (const f of daRipristinare) {
                if (f.boundingBox) {
                  next[f.indice] = verticiDaRettangolo(f.boundingBox)
                }
              }
              return next
            })
            setFaldeRimosse(new Set())
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
  faldeRimosse,
  scegliTetto,
  ripresaInCorso,
  onLayoutChange,
  layoutInizialeFalda,
  onSeleziona,
  onScegliTettoChange,
  onPuntoTetto,
  onPoligonoCambiato,
  onRipristina,
  onEliminaFalda,
  onRipristinaFaldeRimosse,
}: {
  analisi: AnalisiTetto
  poligoni: Record<number, Coordinate[]>
  faldaSelezionata: number | null
  faldeRimosse: ReadonlySet<number>
  scegliTetto: boolean
  ripresaInCorso: boolean
  onLayoutChange?: (layout: LayoutModuliCorrente | null) => void
  layoutInizialeFalda?: LayoutModuliCorrente | null
  onSeleziona: (indice: number | null) => void
  onScegliTettoChange: (attivo: boolean) => void
  onPuntoTetto: (punto: Coordinate) => void
  onPoligonoCambiato: (indice: number, vertici: Coordinate[]) => void
  onRipristina: (indice: number) => void
  onEliminaFalda: (indice: number) => void
  onRipristinaFaldeRimosse: () => void
}) {
  const faldeVisibili = useMemo(
    () => analisi.falde.filter((f) => !faldeRimosse.has(f.indice)),
    [analisi.falde, faldeRimosse],
  )
  const analisiVista = useMemo(
    () => ({ ...analisi, falde: faldeVisibili }),
    [analisi, faldeVisibili],
  )

  const dsmChiave = `${analisi.location.latitude.toFixed(5)}:${analisi.location.longitude.toFixed(5)}`
  const [dsm, setDsm] = useState<{
    chiave: string
    stato: 'caricamento' | 'ok' | 'errore'
    griglia: GrigliaDsm | null
    errore: string | null
  }>({ chiave: '', stato: 'caricamento', griglia: null, errore: null })
  /** Durante lo spostamento moduli non si cambia falda (evita perdite). */
  const [trascinamentoModuli, setTrascinamentoModuli] = useState(false)
  const selezionaFalda = useCallback(
    (indice: number | null) => {
      if (trascinamentoModuli) return
      onSeleziona(indice)
    },
    [onSeleziona, trascinamentoModuli],
  )


  useEffect(() => {
    let annullato = false
    void (async () => {
      const esito = await caricaDsmEdificio({
        latitude: analisi.location.latitude,
        longitude: analisi.location.longitude,
        boundingBox: analisi.boundingBox,
      })
      if (annullato) return
      if (!esito.ok) {
        setDsm({
          chiave: dsmChiave,
          stato: 'errore',
          griglia: null,
          errore: esito.errors._ ?? 'Quote non disponibili.',
        })
        return
      }
      setDsm({
        chiave: dsmChiave,
        stato: 'ok',
        griglia: esito.data,
        errore: null,
      })
    })()
    return () => {
      annullato = true
    }
  }, [analisi.location.latitude, analisi.location.longitude, analisi.boundingBox, dsmChiave])

  const dsmPronto = dsm.chiave === dsmChiave
  const dsmStato = dsmPronto ? dsm.stato : 'caricamento'
  const grigliaDsm = dsmPronto ? dsm.griglia : null
  const dsmErrore = dsmPronto ? dsm.errore : null

  const falda =
    faldaSelezionata != null
      ? faldeVisibili.find((f) => f.indice === faldaSelezionata) ?? null
      : null
  const verticiSelezionati =
    faldaSelezionata != null ? poligoni[faldaSelezionata] ?? null : null

  return (
    <div className="space-y-4">
      <Card
        title={falda ? `Designer falda ${falda.indice + 1}` : 'Seleziona la falda'}
      >
        {falda == null ? (
          <div className="min-w-0">
            <p className="mb-3 text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Seleziona una falda — dai marker sulla mappa o dalla tabella qui
              sotto — per aprire il designer e regolarne il perimetro sulla foto
              aerea.
            </p>
            <MappaTetto
              analisi={analisiVista}
              poligoni={poligoni}
              faldaSelezionata={faldaSelezionata}
              onSeleziona={selezionaFalda}
              onPoligonoCambiato={onPoligonoCambiato}
              scegliTetto={scegliTetto}
              onScegliTettoChange={onScegliTettoChange}
              onPuntoTetto={onPuntoTetto}
              ripresaInCorso={ripresaInCorso}
            />
          </div>
        ) : (
          <div className="min-w-0 space-y-3">
            <button
              type="button"
              onClick={() => selezionaFalda(null)}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition hover:brightness-125"
              style={{
                borderColor: 'var(--bordo)',
                background: 'rgba(5,10,20,0.45)',
                color: 'var(--testo-tenue)',
              }}
            >
              ← Cambia falda
            </button>
            <EditorModuli
              key={falda.indice}
              falda={falda}
              poligono={verticiSelezionati}
              layoutIniziale={layoutInizialeFalda}
              onLayoutChange={onLayoutChange}
              onPoligonoChange={(vertici) =>
                onPoligonoCambiato(falda.indice, [...vertici])
              }
              onTrascinamentoChange={setTrascinamentoModuli}
            />
          </div>
        )}
        <p className="mt-3 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          {dsmStato === 'caricamento'
            ? 'Preparazione quote del tetto…'
            : dsmStato === 'ok' && grigliaDsm
              ? 'Quote pronte: sezione e vista 3D disponibili sulla falda selezionata.'
              : dsmStato === 'errore'
                ? `Quote non disponibili: ${dsmErrore}`
                : null}
        </p>
      </Card>

      {falda && verticiSelezionati ? (
        <PannelloFalda
          falda={falda}
          vertici={verticiSelezionati}
          grigliaDsm={grigliaDsm}
          dsmStato={dsmStato}
          onDeseleziona={() => selezionaFalda(null)}
          onRipristina={() => onRipristina(falda.indice)}
          onElimina={() => onEliminaFalda(falda.indice)}
        />
      ) : (
        <Card>
          <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            Seleziona una falda dalla mappa o dalla tabella per regolarne il
            perimetro, vedere sezione e vista 3D e leggere le misure lato per
            lato. Puoi eliminare le falde che non ti interessano.
          </p>
        </Card>
      )}

      <CardEdificio analisi={analisi} />

      <TabellaFalde
        faldeVisibili={faldeVisibili}
        totaleFalde={analisi.falde.length}
        poligoni={poligoni}
        faldaSelezionata={faldaSelezionata}
        faldeRimosse={faldeRimosse}
        trascinamentoModuli={trascinamentoModuli}
        onSeleziona={selezionaFalda}
        onEliminaFalda={onEliminaFalda}
        onRipristinaFaldeRimosse={onRipristinaFaldeRimosse}
      />
    </div>
  )
}

function PannelloFalda({
  falda,
  vertici,
  grigliaDsm,
  dsmStato,
  onDeseleziona,
  onRipristina,
  onElimina,
}: {
  falda: FaldaTetto
  vertici: readonly Coordinate[]
  grigliaDsm: GrigliaDsm | null
  dsmStato: 'idle' | 'caricamento' | 'ok' | 'errore'
  onDeseleziona: () => void
  onRipristina: () => void
  onElimina: () => void
}) {
  const lati = useMemo(() => latiPoligono(vertici), [vertici])
  const areaEditata = useMemo(() => areaPoligonoMetri2(vertici), [vertici])
  const perimetro = useMemo(() => perimetroPoligonoMetri(vertici), [vertici])
  const seed = falda.boundingBox
    ? verticiDaRettangolo(falda.boundingBox)
    : null
  const modificata = seed ? !poligoniQuasiUguali(vertici, seed) : false

  /** Sezione/3D restano chiusi finché non servono (mesh DSM è pesante su mobile). */
  const [mostraDsmViz, setMostraDsmViz] = useState(false)

  const profilo = useMemo(
    () =>
      mostraDsmViz && grigliaDsm
        ? profiloSezioneDsm(grigliaDsm, vertici, falda.azimuthDegrees)
        : null,
    [mostraDsmViz, grigliaDsm, vertici, falda.azimuthDegrees],
  )
  const mesh = useMemo(
    () =>
      mostraDsmViz && grigliaDsm ? meshFaldaDaDsm(grigliaDsm, vertici) : null,
    [mostraDsmViz, grigliaDsm, vertici],
  )

  return (
    <Card title={`Falda ${falda.indice + 1}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Inclinazione
            </dt>
            <dd className="mt-0.5 tabular-nums font-medium">
              {falda.pitchDegrees.toFixed(1)}°
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Esposizione
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
              Area rilevata
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
            Ripristina perimetro iniziale
          </button>
          <button
            type="button"
            onClick={onDeseleziona}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
          >
            Deseleziona
          </button>
          <button
            type="button"
            onClick={onElimina}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: 'rgba(224, 133, 133, 0.45)',
              color: '#e8a0a0',
            }}
          >
            Elimina falda
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

      <div
        className="mt-5 border-t pt-5"
        style={{ borderColor: 'var(--bordo-tenue)' }}
      >
        <button
          type="button"
          onClick={() => setMostraDsmViz((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition"
          style={{
            borderColor: 'var(--bordo)',
            background: mostraDsmViz
              ? 'rgba(217, 164, 65, 0.08)'
              : 'rgba(5,10,20,0.35)',
            color: 'var(--testo)',
          }}
          aria-expanded={mostraDsmViz}
        >
          <span>
            <span className="font-medium">Sezione e vista 3D</span>
            <span
              className="mt-0.5 block text-xs"
              style={{ color: 'var(--testo-fioco)' }}
            >
              {dsmStato === 'caricamento'
                ? 'Quote in preparazione…'
                : dsmStato === 'errore'
                  ? 'Quote non disponibili'
                  : 'Profilo e modello 3D della falda'}
            </span>
          </span>
          <span
            className="shrink-0 text-xs tabular-nums"
            style={{ color: '#e8c765' }}
          >
            {mostraDsmViz ? 'Chiudi' : 'Apri'}
          </span>
        </button>

        {mostraDsmViz ? (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            {dsmStato === 'caricamento' ? (
              <p
                className="text-xs lg:col-span-2"
                style={{ color: 'var(--testo-tenue)' }}
              >
                Attendere le quote del tetto per sezione e vista 3D…
              </p>
            ) : (
              <>
                <SezioneFalda
                  profilo={profilo}
                  pitchSolar={falda.pitchDegrees}
                />
                <Vista3dFalda mesh={mesh} />
              </>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
        Le quote sono indicative e non sostituiscono un rilievo di cantiere.
        {falda.planeHeightAtCenterMeters != null
          ? ` Quota stimata al centro: ${falda.planeHeightAtCenterMeters.toFixed(1)} m s.l.m.`
          : null}
      </p>
    </Card>
  )
}
