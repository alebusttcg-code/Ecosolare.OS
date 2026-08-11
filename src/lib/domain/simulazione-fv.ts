import { calcolaEffettoAccumulo, type EsitoAccumulo } from '@/lib/domain/accumulo'
import {
  calcolaEconomiaTermico,
  fabbisognoTermicoDaGas,
  rateContoTermico,
  type EconomiaTermico,
} from '@/lib/domain/economia-termico'
import { bilanciaEnergia, type BilancioEnergia } from '@/lib/domain/bilancio-energia'
import {
  calcolaEconomiaFv,
  type EconomiaFv,
} from '@/lib/domain/economia-fv'
import {
  calcolaDetrazioneIrpef,
  type DetrazioneIrpef,
} from '@/lib/domain/incentivi'
import {
  contaModuli,
  kWpDaLayouts,
  layoutsAttivi,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'

/**
 * Parametri di simulazione provenienti da config (A18), mai da costanti di
 * calcolo nei caller di business.
 */
export type ParametriSimulazioneFv = {
  readonly detrazionePct: number
  readonly detrazioneAnni: number
  readonly orizzonteAnni: number
  readonly inflazioneEnergiaPct: number
  readonly tassoScontoPct: number
  readonly degradazioneProduzionePctAnno: number
  /** Usata solo se lo studio non ha una frazione esplicita. */
  readonly frazioneAutoconsumoDefault: number
}

export type InputSimulazioneFv = {
  readonly snapshot: SnapshotStudioTetto
  /**
   * Capacità di accumulo del preventivo, in kWh. Zero o assente = nessuna
   * batteria. Arriva dalle righe (`leggiConfigurazione`), non da una
   * costante: una batteria da 5 kWh e una da 10 kWh devono produrre numeri
   * diversi.
   */
  readonly capacitaAccumuloKwh?: number
  /**
   * Potenza nominale in alternata degli inverter, dalle righe del preventivo.
   * Serve al sovradimensionamento CC/CA della scheda tecnica.
   */
  readonly potenzaCaKw?: number | null
  /**
   * Impianto termico del preventivo, quando c'e'. Il suo costo e' gia' dentro
   * `investimentoLordoCents` — e' una riga come le altre — quindi senza il suo
   * risparmio il rientro uscirebbe falsato in peggio.
   */
  readonly termico?: InputTermicoSimulazione | null
  /** Totale lordo preventivo (IVA inclusa), centesimi. */
  readonly investimentoLordoCents: number
  readonly parametri: ParametriSimulazioneFv
}

export type FaldaSimulazione = {
  readonly indice: number
  readonly pitchDegrees: number
  readonly azimuthDegrees: number
  readonly areaMeters2: number | null
  readonly moduli: number
  readonly kWp: number
}

export type RisultatoSimulazioneFv = {
  readonly moduli: number
  readonly kWp: number
  /** Watt di picco se unici su tutte le falde, altrimenti null. */
  readonly wattPicco: number | null
  readonly produzioneKwh: number
  readonly consumoKwh: number
  readonly resaSpecificaKwhKwp: number | null
  readonly tariffaImportEurKwh: number
  readonly tariffaExportEurKwh: number
  /** Autoconsumo prima dell'eventuale accumulo. */
  readonly frazioneAutoconsumoUsata: number
  /** Autoconsumo che alimenta davvero bilancio e PDF. */
  readonly frazioneAutoconsumoEffettiva: number
  /** Effetto dell'accumulo sull'autoconsumo; assente se non c'è batteria. */
  readonly accumulo: EsitoAccumulo | null
  /** Economia della pompa di calore; null se il preventivo non ne ha una. */
  readonly termico: EconomiaTermico | null
  /** Potenza CA dichiarata dai prodotti; null se il catalogo non la dice. */
  readonly potenzaCaKw: number | null
  readonly falde: readonly FaldaSimulazione[]
  readonly bilancio: BilancioEnergia
  /** Detrazione riferita alla sola quota fotovoltaica. */
  readonly detrazione: DetrazioneIrpef
  /** Detrazione termica, solo quando scelta al posto del Conto Termico. */
  readonly detrazioneTermico: DetrazioneIrpef | null
  readonly agevolazioni: AgevolazioniSimulazione
  readonly parametriEconomici: Pick<
    ParametriSimulazioneFv,
    'tassoScontoPct' | 'degradazioneProduzionePctAnno'
  >
  readonly economia: EconomiaFv
}

export interface AgevolazioniSimulazione {
  readonly investimentoLordoCents: number
  readonly investimentoFvLordoCents: number
  readonly investimentoTermicoLordoCents: number
  readonly detrazioneTotaleCents: number
  readonly contoTermicoTotaleCents: number
  /** Costo complessivo dopo i benefici selezionati, non l'esborso iniziale. */
  readonly investimentoEffettivoCents: number
  /** Quota FV dopo la sua detrazione, usata per il LCOE fotovoltaico. */
  readonly investimentoFvEffettivoCents: number
  readonly incentivoTermico: InputTermicoSimulazione['incentivo'] | null
}

/** Ciò che serve sapere del termico per farlo entrare nel piano economico. */
export interface InputTermicoSimulazione {
  /** Gas dell'ultimo anno, dalla bolletta del cliente. */
  readonly consumoGasAnnuoSmc: number
  /** Quota che resta a gas (cucina), in Smc. */
  readonly gasNonSostituitoSmc?: number
  /** Rendimento stagionale della pompa di calore. */
  readonly scop: number
  readonly prezzoGasEurSmc: number
  /** Quota di prezzo del preventivo riferita al blocco termico. */
  readonly prezzoLordoCents: number
  /** Agevolazione alternativa scelta sulle spese termiche. */
  readonly incentivo: 'detrazione' | 'conto_termico' | 'nessuno'
  readonly detrazionePct?: number
  readonly anniDetrazione?: number
  /** Conto Termico complessivo, in centesimi, solo quando scelto. */
  readonly contoTermicoCents?: number
  readonly anniErogazioneContoTermico?: number
}

export function simulaImpiantoFv(input: InputSimulazioneFv): RisultatoSimulazioneFv {
  const { snapshot, parametri } = input
  const layouts = layoutsAttivi(snapshot)
  const moduli = contaModuli(layouts)
  const kWp = kWpDaLayouts(layouts)
  const produzioneKwh = Math.round(snapshot.produzioneAnnuakWh)
  const consumoKwh = Math.round(snapshot.consumoAnnuoKwh)
  const frazioneAutoconsumoUsata =
    snapshot.frazioneAutoconsumo != null &&
    Number.isFinite(snapshot.frazioneAutoconsumo)
      ? snapshot.frazioneAutoconsumo
      : parametri.frazioneAutoconsumoDefault

  /*
   * L'accumulo alza l'autoconsumo, e quindi cambia risparmio, payback e valore
   * attuale. Prima la batteria era una riga di prezzo che non spostava un solo
   * numero: il cliente vedeva seimila euro di accumulo e un risparmio identico
   * a quello di un impianto senza.
   */
  const accumulo = calcolaEffettoAccumulo({
    capacitaNominaleKwh: input.capacitaAccumuloKwh ?? 0,
    produzioneAnnuaKwh: produzioneKwh,
    consumoAnnuoKwh: consumoKwh,
    frazioneAutoconsumoDiretta: frazioneAutoconsumoUsata,
  })

  const bilancio = bilanciaEnergia({
    produzioneKwh,
    consumoKwh,
    frazioneAutoconsumo: accumulo.frazioneAutoconsumoConAccumulo,
  })

  const investimentoLordoCents = Math.max(
    0,
    Math.round(input.investimentoLordoCents),
  )
  const investimentoTermicoLordoCents = input.termico
    ? Math.min(
        investimentoLordoCents,
        Math.max(0, Math.round(input.termico.prezzoLordoCents)),
      )
    : 0
  const investimentoFvLordoCents =
    investimentoLordoCents - investimentoTermicoLordoCents

  const detrazione = calcolaDetrazioneIrpef({
    prezzoLordoCents: investimentoFvLordoCents,
    detrazionePct: parametri.detrazionePct,
    anniRate: parametri.detrazioneAnni,
  })

  /*
   * Le spese termiche hanno una scelta esplicita. Per persone fisiche e
   * condomini il Conto Termico 3.0 non e' cumulabile con altri incentivi
   * statali sulle stesse spese: non possono quindi entrare entrambi nel
   * cashflow per dimenticanza del template.
   */
  const detrazioneTermico =
    input.termico?.incentivo === 'detrazione'
      ? calcolaDetrazioneIrpef({
          prezzoLordoCents: investimentoTermicoLordoCents,
          detrazionePct: input.termico.detrazionePct ?? 0,
          anniRate: input.termico.anniDetrazione ?? parametri.detrazioneAnni,
        })
      : null

  /*
   * Il termico entra qui: fabbisogno dedotto dal gas realmente consumato,
   * risparmio come differenza fra le due bollette, Conto Termico ripartito
   * sulle sue rate.
   */
  const termicoCalcolabile = Boolean(
    input.termico &&
      input.termico.consumoGasAnnuoSmc > 0 &&
      input.termico.scop > 0 &&
      input.termico.prezzoGasEurSmc > 0,
  )
  const termico = input.termico && termicoCalcolabile
    ? calcolaEconomiaTermico({
        fabbisognoTermicoKwh: fabbisognoTermicoDaGas({
          consumoGasAnnuoSmc: input.termico.consumoGasAnnuoSmc,
          ...(input.termico.gasNonSostituitoSmc != null
            ? { gasNonSostituitoSmc: input.termico.gasNonSostituitoSmc }
            : {}),
        }),
        scop: input.termico.scop,
        prezzoGasEurSmc: input.termico.prezzoGasEurSmc,
        prezzoElettricoEurKwh: snapshot.tariffaImportEurKwh,
      })
    : null

  const contoTermicoCents =
    input.termico?.incentivo === 'conto_termico'
      ? Math.max(0, Math.round(input.termico.contoTermicoCents ?? 0))
      : 0

  const apportoTermico = input.termico
    ? {
        risparmioAnnuoCents: termico?.risparmioAnnuoCents ?? 0,
        rateContoTermicoCents: rateContoTermico(
          contoTermicoCents,
          input.termico.anniErogazioneContoTermico ?? 5,
        ),
      }
    : null

  const economia = calcolaEconomiaFv({
    bilancio,
    tariffaImportEurKwh: snapshot.tariffaImportEurKwh,
    tariffaExportEurKwh: snapshot.tariffaExportEurKwh,
    investimentoLordoCents,
    detrazione,
    detrazioniAggiuntive: detrazioneTermico ? [detrazioneTermico] : [],
    orizzonteAnni: parametri.orizzonteAnni,
    inflazioneEnergiaPct: parametri.inflazioneEnergiaPct,
    tassoScontoPct: parametri.tassoScontoPct,
    degradazioneProduzionePctAnno: parametri.degradazioneProduzionePctAnno,
    termico: apportoTermico,
  })

  const faldeRimosse = new Set(snapshot.faldeRimosse)
  const layoutPerFalda = new Map(layouts.map((l) => [l.faldaIndice, l]))
  const falde: FaldaSimulazione[] = (snapshot.analisi.falde ?? [])
    .filter((f) => !faldeRimosse.has(f.indice))
    .map((f) => {
      const L = layoutPerFalda.get(f.indice)
      return {
        indice: f.indice,
        pitchDegrees: f.pitchDegrees,
        azimuthDegrees: f.azimuthDegrees,
        areaMeters2: f.areaMeters2,
        moduli: L?.moduli.length ?? 0,
        kWp: L ? (L.moduli.length * L.wattPicco) / 1000 : 0,
      }
    })

  const wattUnici = new Set(layouts.map((l) => l.wattPicco))
  const detrazioneTotaleCents =
    detrazione.detrazioneTotaleCents +
    (detrazioneTermico?.detrazioneTotaleCents ?? 0)
  const agevolazioni: AgevolazioniSimulazione = {
    investimentoLordoCents,
    investimentoFvLordoCents,
    investimentoTermicoLordoCents,
    detrazioneTotaleCents,
    contoTermicoTotaleCents: contoTermicoCents,
    investimentoEffettivoCents: Math.max(
      0,
      investimentoLordoCents - detrazioneTotaleCents - contoTermicoCents,
    ),
    investimentoFvEffettivoCents: detrazione.prezzoNettoIndicativoCents,
    incentivoTermico: input.termico?.incentivo ?? null,
  }

  return {
    moduli,
    kWp,
    wattPicco: wattUnici.size === 1 ? [...wattUnici][0]! : null,
    produzioneKwh,
    consumoKwh,
    resaSpecificaKwhKwp: kWp > 0 ? Math.round(produzioneKwh / kWp) : null,
    tariffaImportEurKwh: snapshot.tariffaImportEurKwh,
    tariffaExportEurKwh: snapshot.tariffaExportEurKwh,
    frazioneAutoconsumoUsata,
    frazioneAutoconsumoEffettiva:
      accumulo.frazioneAutoconsumoConAccumulo,
    accumulo: accumulo.haAccumulo ? accumulo : null,
    termico,
    potenzaCaKw: input.potenzaCaKw ?? null,
    falde,
    bilancio,
    detrazione,
    detrazioneTermico,
    agevolazioni,
    parametriEconomici: {
      tassoScontoPct: parametri.tassoScontoPct,
      degradazioneProduzionePctAnno:
        parametri.degradazioneProduzionePctAnno,
    },
    economia,
  }
}
