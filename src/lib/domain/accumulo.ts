import { GIORNI_MESE, PESI_MENSILI_FV_ITALIA } from './produzione-fv'

/**
 * Effetto di una batteria di accumulo sull'autoconsumo.
 *
 * Il problema che risolve: senza questo modulo una batteria da 10 kWh entra nel
 * preventivo come una riga di prezzo e **non cambia un solo numero** della
 * simulazione. Il cliente vede seimila euro di accumulo e un risparmio identico
 * a quello di un impianto senza accumulo — cioè non trova da nessuna parte la
 * ragione per cui dovrebbe comprarla, e il payback che gli mostriamo è
 * sbagliato per difetto.
 *
 * ## Il modello
 *
 * Mese per mese, non su media annua. Su media annua un accumulo da 10 kWh su
 * un consumo di 4.000 kWh sembrerebbe coprire quasi tutto il prelievo: è falso,
 * perché a dicembre il surplus da immagazzinare non esiste. La forma stagionale
 * della produzione la conosciamo già (`PESI_MENSILI_FV_ITALIA`), quindi il
 * calcolo mensile non costa nulla in più e non mente.
 *
 * Per ogni mese si prende il minimo fra tre limiti fisici:
 *
 *  1. quanto la batteria può ciclare (capacità utile × giorni del mese);
 *  2. quanta energia avanza dopo l'autoconsumo diretto (non si può
 *     immagazzinare ciò che è già stato consumato);
 *  3. quanta energia si sta ancora prelevando dalla rete (immagazzinare più
 *     del fabbisogno residuo non serve a niente).
 *
 * Al risultato si applica il rendimento di ciclo: l'energia che entra non è
 * quella che esce.
 *
 * ## Cosa questo modello NON è
 *
 * Non è una simulazione oraria. Assume che il surplus del giorno e il prelievo
 * serale del giorno siano contemporanei entro le 24 ore, il che è vero per un
 * profilo domestico e falso per casi particolari (seconda casa usata nei fine
 * settimana, utenze notturne). È dichiaratamente una stima prudente, e la
 * prudenza sta nel fatto che il minimo fra tre limiti non può sovrastimare.
 */

/** Profondità di scarica utile di una batteria al litio ferro-fosfato. */
export const PROFONDITA_SCARICA_DEFAULT = 0.9

/** Rendimento di ciclo carica-scarica, inverter ibrido incluso. */
export const RENDIMENTO_CICLO_DEFAULT = 0.9

export interface InputAccumulo {
  /** Capacità nominale di targa, in kWh. Zero o assente = nessun accumulo. */
  readonly capacitaNominaleKwh: number
  readonly produzioneAnnuaKwh: number
  readonly consumoAnnuoKwh: number
  /** Frazione di produzione autoconsumata SENZA accumulo, in [0, 1]. */
  readonly frazioneAutoconsumoDiretta: number
  readonly profonditaScarica?: number
  readonly rendimentoCiclo?: number
}

export interface EsitoAccumulo {
  /** Frazione di produzione autoconsumata CON l'accumulo, in [0, 1]. */
  readonly frazioneAutoconsumoConAccumulo: number
  /** kWh che l'accumulo sposta dalla rete all'autoconsumo in un anno. */
  readonly energiaRecuperataKwh: number
  /** Cicli equivalenti pieni all'anno: dice se la batteria è ben dimensionata. */
  readonly cicliEquivalentiAnno: number
  readonly capacitaUtileKwh: number
  readonly haAccumulo: boolean
}

function limita(valore: number, minimo: number, massimo: number): number {
  if (!Number.isFinite(valore)) return minimo
  return Math.min(massimo, Math.max(minimo, valore))
}

/**
 * Numero finito e non negativo, o zero.
 *
 * `Math.max(0, Infinity)` resta `Infinity`, e un'infinità moltiplicata per
 * zero mesi produce `NaN` che si propaga fino al PDF: meglio trattare
 * l'assurdo come «nessun dato» qui, dove si vede.
 */
function finitoNonNegativo(valore: number): number {
  if (!Number.isFinite(valore) || valore <= 0) return 0
  return valore
}

export function calcolaEffettoAccumulo(input: InputAccumulo): EsitoAccumulo {
  const frazioneDiretta = limita(input.frazioneAutoconsumoDiretta, 0, 1)
  const produzione = finitoNonNegativo(input.produzioneAnnuaKwh)
  const consumo = finitoNonNegativo(input.consumoAnnuoKwh)
  const capacita = finitoNonNegativo(input.capacitaNominaleKwh)

  const nessunEffetto: EsitoAccumulo = {
    frazioneAutoconsumoConAccumulo: frazioneDiretta,
    energiaRecuperataKwh: 0,
    cicliEquivalentiAnno: 0,
    capacitaUtileKwh: 0,
    haAccumulo: false,
  }

  if (capacita <= 0 || produzione <= 0 || consumo <= 0) return nessunEffetto

  const capacitaUtile =
    capacita * limita(input.profonditaScarica ?? PROFONDITA_SCARICA_DEFAULT, 0.1, 1)
  const rendimento = limita(
    input.rendimentoCiclo ?? RENDIMENTO_CICLO_DEFAULT,
    0.5,
    1,
  )

  let recuperata = 0

  for (let mese = 0; mese < 12; mese += 1) {
    const produzioneMese = produzione * PESI_MENSILI_FV_ITALIA[mese]!
    // Il consumo domestico si assume piatto: senza un profilo di consumo reale,
    // inventarne uno stagionale sposterebbe i numeri senza fondamento.
    const consumoMese = consumo / 12

    const direttoMese = Math.min(produzioneMese * frazioneDiretta, consumoMese)
    const surplusMese = Math.max(0, produzioneMese - direttoMese)
    const daReteMese = Math.max(0, consumoMese - direttoMese)
    const cicloMassimoMese = capacitaUtile * GIORNI_MESE[mese]!

    recuperata += Math.min(cicloMassimoMese, surplusMese, daReteMese) * rendimento
  }

  // L'autoconsumo totale non può superare né la produzione né il consumo.
  const direttoAnnuo = Math.min(produzione * frazioneDiretta, consumo)
  const autoconsumoTotale = Math.min(direttoAnnuo + recuperata, produzione, consumo)
  const recuperataEffettiva = Math.max(0, autoconsumoTotale - direttoAnnuo)

  return {
    frazioneAutoconsumoConAccumulo: autoconsumoTotale / produzione,
    energiaRecuperataKwh: Math.round(recuperataEffettiva),
    cicliEquivalentiAnno:
      capacitaUtile > 0 ? recuperataEffettiva / rendimento / capacitaUtile : 0,
    capacitaUtileKwh: capacitaUtile,
    haAccumulo: true,
  }
}
