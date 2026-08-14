import type { BilancioEnergia } from '@/lib/domain/bilancio-energia'
import {
  rateDetrazionePerAnno,
  type DetrazioneIrpef,
} from '@/lib/domain/incentivi'
import { dividiArrotondando } from '@/lib/domain/money'

/**
 * Economia FV lato cliente: bollette, risparmio, cashflow, payback, NPV.
 *
 * Tutte le tariffe, inflazione, sconto e orizzonte sono input del caso
 * (studio + config vigente): lo stesso motore produce risultati diversi per
 * ogni cliente.
 */

/**
 * Le voci del termico che entrano nel piano economico.
 *
 * Sono separate dal fotovoltaico perche' seguono regole diverse: il risparmio
 * sul gas cresce con l'inflazione ma non degrada (una pompa di calore non
 * perde resa come un modulo), e il Conto Termico e' un contributo a fondo
 * perduto erogato in poche rate, non una detrazione decennale.
 */
export type ApportoTermico = {
  /** Risparmio annuo sul riscaldamento, anno 1. Puo' essere negativo. */
  readonly risparmioAnnuoCents: number
  /** Rate del Conto Termico, dalla prima in poi. */
  readonly rateContoTermicoCents: readonly number[]
}

export type InputEconomiaFv = {
  readonly bilancio: BilancioEnergia
  readonly tariffaImportEurKwh: number
  readonly tariffaExportEurKwh: number
  /** Investimento IVA inclusa, centesimi (totale lordo preventivo FV). */
  readonly investimentoLordoCents: number
  readonly detrazione: DetrazioneIrpef
  /** Detrazioni su basi separate, per esempio il solo blocco termico. */
  readonly detrazioniAggiuntive?: readonly DetrazioneIrpef[]
  readonly orizzonteAnni: number
  /** Inflazione prezzo energia, punti percentuali (es. 3 = +3%/anno). */
  readonly inflazioneEnergiaPct: number
  /** Tasso di sconto NPV, punti percentuali. */
  readonly tassoScontoPct: number
  /** Degradazione produzione, punti percentuali/anno. */
  readonly degradazioneProduzionePctAnno: number
  /**
   * Presente quando il preventivo comprende una pompa di calore. Senza,
   * l'impianto termico peserebbe sull'investimento senza portare il proprio
   * risparmio, e il rientro apparirebbe molto peggiore del vero.
   */
  readonly termico?: ApportoTermico | null
}

export type AnnoSimulazione = {
  readonly anno: number
  readonly risparmioEnergiaCents: number
  /** Risparmio sul riscaldamento, se c'e' un impianto termico. */
  readonly risparmioTermicoCents: number
  readonly rataDetrazioneCents: number
  /** Rata del Conto Termico incassata nell'anno. */
  readonly rataContoTermicoCents: number
  readonly flussoCents: number
  readonly flussoAttualizzatoCents: number
}

export type EconomiaFv = {
  readonly bollettaAttualeAnnuacents: number
  /** Saldo netto annuo: puo' essere negativo se la cessione supera il prelievo. */
  readonly bollettaConFvAnnuacents: number
  readonly bollettaAttualeMensileCents: number
  /**
   * Quanto resta da pagare al mese, **mai sotto zero**.
   *
   * Il saldo netto — prelievo meno cessione — e' la misura corretta del costo
   * ed e' quella che i preventivi gia' consegnati riportano (Riboldi: 77,91
   * €/mese). Ma con un accumulo generoso quel saldo puo' diventare negativo, e
   * una bolletta negativa non esiste: il ritiro dedicato lo liquida il GSE con
   * un bonifico separato, non scalato dalla fattura del fornitore. Stampare
   * «-12,25 €/mese» prometterebbe una cosa che non accadra'.
   */
  readonly bollettaConFvMensileCents: number
  /**
   * L'eccedenza mensile quando la cessione supera il prelievo: e' un accredito
   * del GSE, non uno sconto in bolletta, e va detto separatamente.
   */
  readonly creditoMensileCents: number
  readonly risparmioMensileCents: number
  readonly risparmioTermicoAnno1Cents: number
  /** FV + termico nell'anno 1, senza incentivi una tantum o detrazioni. */
  readonly beneficioAnnuoAnno1Cents: number
  readonly risparmioAnnuoAnno1Cents: number
  /** Anni al recupero (con detrazione nel flusso), null se non recupera. */
  readonly paybackAnni: number | null
  readonly npvCents: number
  readonly cashflow: readonly AnnoSimulazione[]
}

/** kWh × €/kWh → centesimi, arrotondamento commerciale. */
export function costoEnergiaCents(kwh: number, tariffaEurKwh: number): number {
  if (!(kwh > 0) || !(tariffaEurKwh > 0)) return 0
  return Math.round(kwh * tariffaEurKwh * 100)
}

/**
 * Bolletta annua con FV: costo energia da rete meno valorizzazione export RID.
 * Può essere negativa (credito netto da cessione).
 */
export function bollettaConFvAnnuacents(
  bilancio: BilancioEnergia,
  tariffaImportEurKwh: number,
  tariffaExportEurKwh: number,
): number {
  const costoRete = costoEnergiaCents(bilancio.daReteKwh, tariffaImportEurKwh)
  const ricavoExport = costoEnergiaCents(bilancio.exportKwh, tariffaExportEurKwh)
  return costoRete - ricavoExport
}

export function calcolaEconomiaFv(input: InputEconomiaFv): EconomiaFv {
  const bollettaAttualeAnnuacents = costoEnergiaCents(
    input.bilancio.consumoKwh,
    input.tariffaImportEurKwh,
  )
  const bollettaConFv = bollettaConFvAnnuacents(
    input.bilancio,
    input.tariffaImportEurKwh,
    input.tariffaExportEurKwh,
  )
  const risparmioAnnuoAnno1Cents = bollettaAttualeAnnuacents - bollettaConFv
  const risparmioTermicoAnno1Cents = input.termico?.risparmioAnnuoCents ?? 0
  const beneficioAnnuoAnno1Cents =
    risparmioAnnuoAnno1Cents + risparmioTermicoAnno1Cents

  const bollettaAttualeMensileCents = dividiArrotondando(
    bollettaAttualeAnnuacents,
    12,
  )
  /*
   * Il saldo netto resta la misura del costo — ed e' quella dei preventivi gia'
   * consegnati. Quando pero' scende sotto zero, la cifra si spezza in due: si
   * mostra zero da pagare e l'eccedenza come accredito, perche' e' quello che
   * succede davvero. Il risparmio non cambia: e' sempre la differenza fra le
   * due bollette.
   */
  const saldoMensile = dividiArrotondando(bollettaConFv, 12)
  const bollettaConFvMensileCents = Math.max(0, saldoMensile)
  const creditoMensileCents = Math.max(0, -saldoMensile)
  const risparmioMensileCents = bollettaAttualeMensileCents - saldoMensile

  const orizzonte = Math.max(1, Math.round(input.orizzonteAnni))
  const infl = input.inflazioneEnergiaPct / 100
  const degr = input.degradazioneProduzionePctAnno / 100
  const sconto = input.tassoScontoPct / 100
  const detrazioni = [input.detrazione, ...(input.detrazioniAggiuntive ?? [])]
  const ratePerDetrazione = detrazioni.map(rateDetrazionePerAnno)

  const cashflow: AnnoSimulazione[] = []
  let cumulato = -Math.max(0, Math.round(input.investimentoLordoCents))
  let paybackAnni: number | null = null
  let npvCents = -Math.max(0, Math.round(input.investimentoLordoCents))

  for (let anno = 1; anno <= orizzonte; anno++) {
    const fattoreDegr = Math.pow(1 - degr, anno - 1)
    const fattoreInfl = Math.pow(1 + infl, anno - 1)
    const risparmioEnergiaCents = Math.round(
      risparmioAnnuoAnno1Cents * fattoreDegr * fattoreInfl,
    )
    /*
     * Il risparmio sul riscaldamento segue l'inflazione ma non la degradazione:
     * una pompa di calore non perde resa come un modulo fotovoltaico.
     */
    const risparmioTermicoCents = input.termico
      ? Math.round(input.termico.risparmioAnnuoCents * fattoreInfl)
      : 0
    const rataDetrazioneCents = ratePerDetrazione.reduce(
      (somma, rate) => somma + (rate[anno - 1] ?? 0),
      0,
    )
    const rateContoTermico = input.termico?.rateContoTermicoCents ?? []
    const rataContoTermicoCents =
      anno <= rateContoTermico.length ? (rateContoTermico[anno - 1] ?? 0) : 0

    /*
     * Il flusso è al lordo dei costi di gestione: nessun opex (sostituzione
     * inverter, manutenzione, assicurazione) entra nel piano. È una scelta
     * deliberata (D-020), non una dimenticanza — il modello non deve mai
     * presentare l'opex come incluso, e infatti non lo somma da nessuna parte.
     */
    const flussoCents =
      risparmioEnergiaCents +
      risparmioTermicoCents +
      rataDetrazioneCents +
      rataContoTermicoCents
    const flussoAttualizzatoCents = Math.round(
      flussoCents / Math.pow(1 + sconto, anno),
    )

    cashflow.push({
      anno,
      risparmioEnergiaCents,
      risparmioTermicoCents,
      rataDetrazioneCents,
      rataContoTermicoCents,
      flussoCents,
      flussoAttualizzatoCents,
    })

    cumulato += flussoCents
    if (paybackAnni == null && cumulato >= 0) paybackAnni = anno
    npvCents += flussoAttualizzatoCents
  }

  return {
    bollettaAttualeAnnuacents,
    bollettaConFvAnnuacents: bollettaConFv,
    bollettaAttualeMensileCents,
    bollettaConFvMensileCents,
    creditoMensileCents,
    risparmioMensileCents,
    risparmioTermicoAnno1Cents,
    beneficioAnnuoAnno1Cents,
    risparmioAnnuoAnno1Cents,
    paybackAnni,
    npvCents,
    cashflow,
  }
}
