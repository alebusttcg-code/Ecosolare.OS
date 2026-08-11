/**
 * Gli indicatori che rendono il preventivo credibile.
 *
 * Non sono ornamento: sono i numeri che nel dossier di riferimento occupano
 * due riquadri interi e che fanno sembrare l'offerta uscita da uno strumento
 * di progettazione invece che da un gestionale. Il cliente non li legge tutti;
 * ne legge tre e capisce che dietro c'è un calcolo.
 *
 * ## Le costanti, e da dove vengono
 *
 * Ricavate per divisione dai tre dossier di riferimento (Riboldi, Ricci,
 * Tarantola), non prese da un manuale:
 *
 * | Caso       | Produzione | CO₂ dichiarata | kg/kWh |
 * |------------|-----------:|---------------:|-------:|
 * | Riboldi    |  8.066 kWh |        2,06 t  | 0,2554 |
 * | Ricci      |  7.960 kWh |        2,04 t  | 0,2563 |
 * | Tarantola  |  5.235 kWh |        1,34 t  | 0,2560 |
 *
 * e per gli alberi, dividendo la CO₂ in kg per il numero dichiarato (95, 94,
 * 62): 21,7 kg per albero all'anno in tutti e tre i casi.
 *
 * Restano qui e non in `app_settings` perché non sono valori normativi né
 * commerciali: sono i coefficienti del modello di riferimento, e cambiarli
 * significherebbe smettere di essere confrontabili con i dossier già
 * consegnati ai clienti.
 */

/** Fattore di emissione della rete elettrica italiana, kg CO₂ per kWh. */
export const KG_CO2_PER_KWH = 0.2559

/** CO₂ assorbita da un albero in un anno, in kg. */
export const KG_CO2_PER_ALBERO_ANNO = 21.7

export interface InputIndicatori {
  readonly produzioneAnnuaKwh: number
  readonly potenzaKwp: number
  /** Potenza nominale in corrente alternata dell'inverter, in kW. */
  readonly potenzaCaKw: number | null
  /** Irraggiamento sul piano dei moduli, kWh/m²·anno. */
  readonly irraggiamentoPianoKwhM2: number | null
}

export interface IndicatoriFv {
  /** kWh prodotti per ogni kWp installato. */
  readonly resaSpecificaKwhKwp: number | null
  /** Tonnellate di CO₂ non emesse in un anno. */
  readonly co2EvitataTonnellate: number
  readonly alberiEquivalenti: number
  /** Rapporto fra energia prodotta e producibile: qualità dell'impianto. */
  readonly performanceRatio: number | null
  /** Potenza CC / potenza CA: quanto il campo eccede l'inverter. */
  readonly sovradimensionamentoPct: number | null
  /** Potenza CC realmente ottenibile, al netto di tolleranze e temperatura. */
  readonly potenzaCcMassimaKw: number
}

/**
 * Resa reale del campo rispetto al nominale di targa.
 *
 * I moduli non danno mai la potenza di targa: tolleranza di produzione,
 * temperatura di cella e sporcamento la riducono. Il riferimento dichiara
 * 5,83 kW su 6 kWp, 5,9 su 6 e 3,88 su 4 — fra il 97 e il 98,3%.
 */
const RESA_CC_REALE = 0.972

export function calcolaIndicatori(input: InputIndicatori): IndicatoriFv {
  const produzione = Math.max(0, input.produzioneAnnuaKwh)
  const kWp = Math.max(0, input.potenzaKwp)

  const co2Kg = produzione * KG_CO2_PER_KWH
  const potenzaCcMassimaKw = kWp * RESA_CC_REALE

  return {
    resaSpecificaKwhKwp: kWp > 0 ? produzione / kWp : null,
    co2EvitataTonnellate: co2Kg / 1000,
    alberiEquivalenti: Math.round(co2Kg / KG_CO2_PER_ALBERO_ANNO),
    performanceRatio:
      input.irraggiamentoPianoKwhM2 && input.irraggiamentoPianoKwhM2 > 0 && kWp > 0
        ? produzione / kWp / input.irraggiamentoPianoKwhM2
        : null,
    sovradimensionamentoPct:
      input.potenzaCaKw && input.potenzaCaKw > 0
        ? (potenzaCcMassimaKw / input.potenzaCaKw) * 100
        : null,
    potenzaCcMassimaKw,
  }
}

/* -------------------------------------------------------------------------- */
/*  Indicatori finanziari                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Tasso interno di rendimento, per bisezione.
 *
 * Nessuna formula chiusa esiste: è la radice di un polinomio di grado pari
 * all'orizzonte. La bisezione è lenta e stupida, e per venticinque flussi
 * costa qualche microsecondo — mentre Newton-Raphson su un flusso che cambia
 * segno più volte diverge senza dirlo.
 *
 * `null` quando il tasso non esiste: se i flussi non cambiano mai segno non
 * c'è nessun rendimento da calcolare, e restituire zero sarebbe una bugia.
 */
export function tassoInternoRendimento(
  flussiCents: readonly number[],
  precisione = 1e-7,
): number | null {
  if (flussiCents.length < 2) return null

  const positivi = flussiCents.some((f) => f > 0)
  const negativi = flussiCents.some((f) => f < 0)
  if (!positivi || !negativi) return null

  const van = (tasso: number): number =>
    flussiCents.reduce((somma, f, i) => somma + f / (1 + tasso) ** i, 0)

  let basso = -0.9999
  let alto = 10
  if (van(basso) * van(alto) > 0) return null

  for (let i = 0; i < 200; i += 1) {
    const medio = (basso + alto) / 2
    const valore = van(medio)
    if (Math.abs(valore) < precisione || alto - basso < precisione) return medio
    if (van(basso) * valore < 0) alto = medio
    else basso = medio
  }

  return (basso + alto) / 2
}

/** Ritorno sull'investimento: quanto rende in tutto, in percentuale. */
export function ritornoInvestimentoPct(
  investimentoNettoCents: number,
  flussiPositiviCents: number,
): number | null {
  if (!(investimentoNettoCents > 0)) return null
  return (flussiPositiviCents / investimentoNettoCents) * 100
}

/**
 * Costo livellato dell'energia: quanto costa un kWh prodotto da questo
 * impianto, spalmando l'investimento sull'energia che produrrà.
 *
 * È il numero che permette il confronto diretto con la tariffa di rete, ed è
 * il più efficace da mostrare a un cliente scettico: 0,04 €/kWh contro 0,30.
 * L'energia va attualizzata come i soldi — un kWh fra vent'anni non vale
 * quanto uno di oggi.
 */
export function costoLivellatoEnergiaEurKwh(input: {
  readonly investimentoNettoCents: number
  readonly produzioneAnnuaKwh: number
  readonly orizzonteAnni: number
  readonly tassoScontoPct: number
  readonly degradazionePctAnno: number
}): number | null {
  if (!(input.produzioneAnnuaKwh > 0) || !(input.orizzonteAnni > 0)) return null

  const sconto = input.tassoScontoPct / 100
  const degradazione = input.degradazionePctAnno / 100

  let energiaAttualizzata = 0
  for (let anno = 1; anno <= input.orizzonteAnni; anno += 1) {
    const produzione = input.produzioneAnnuaKwh * (1 - degradazione) ** (anno - 1)
    energiaAttualizzata += produzione / (1 + sconto) ** anno
  }

  if (!(energiaAttualizzata > 0)) return null
  return input.investimentoNettoCents / 100 / energiaAttualizzata
}
