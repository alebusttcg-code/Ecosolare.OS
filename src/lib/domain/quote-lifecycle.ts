import type { EsitoSoglia } from './pricing'

/**
 * Ciclo di vita di una versione di preventivo (ADR-008).
 *
 * La regola che tutto il resto protegge: **una versione inviata non si modifica
 * mai piu'**. Se serve un cambiamento, nasce la versione successiva. Il motivo
 * non e' tecnico ma contrattuale: il cliente ha in mano un PDF con dei numeri,
 * e quei numeri devono restare ricostruibili identici.
 */

export type StatoVersione =
  | 'bozza'
  | 'in_approvazione'
  | 'approvato'
  | 'inviato'
  | 'accettato'
  | 'rifiutato'
  | 'scaduto'

/** Gli unici stati in cui righe, sconti e condizioni possono cambiare. */
const MODIFICABILI: readonly StatoVersione[] = ['bozza']

/** Stati che rappresentano una decisione conclusa del cliente. */
const CONCLUSI: readonly StatoVersione[] = ['accettato', 'rifiutato', 'scaduto']

export function puoModificare(stato: StatoVersione): boolean {
  return MODIFICABILI.includes(stato)
}

/**
 * Un preventivo si elimina solo se non è mai uscito dall'azienda.
 *
 * Da `inviato` in poi i numeri sono un fatto contrattuale (ADR-008): si crea
 * una nuova versione, non si cancella la storia.
 */
export function puoEliminarePreventivo(statoCorrente: StatoVersione): boolean {
  return (
    statoCorrente === 'bozza' ||
    statoCorrente === 'in_approvazione' ||
    statoCorrente === 'approvato'
  )
}

export function eConcluso(stato: StatoVersione): boolean {
  return CONCLUSI.includes(stato)
}

export type EsitoInvio =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: string; readonly richiedeApprovazione: boolean }

/**
 * Verifica se una versione puo' essere inviata al cliente.
 *
 * Il preventivo sotto soglia non e' vietato: richiede l'approvazione della
 * direzione (§5.7). La differenza conta — l'obiettivo e' rendere consapevole la
 * decisione di erodere il margine, non impedirla.
 */
export function puoInviare(params: {
  readonly stato: StatoVersione
  readonly esitoSoglia: EsitoSoglia
  readonly haRighe: boolean
}): EsitoInvio {
  if (!params.haRighe) {
    return {
      ok: false,
      motivo: 'Il preventivo non contiene righe.',
      richiedeApprovazione: false,
    }
  }

  if (params.stato === 'approvato') return { ok: true }

  if (params.stato !== 'bozza') {
    return {
      ok: false,
      motivo: `Una versione in stato "${params.stato}" non può essere inviata.`,
      richiedeApprovazione: false,
    }
  }

  if (params.esitoSoglia === 'sotto_soglia') {
    return {
      ok: false,
      motivo: 'Il margine è sotto la soglia minima: serve l\'approvazione della direzione.',
      richiedeApprovazione: true,
    }
  }

  if (params.esitoSoglia === 'non_valutabile') {
    return {
      ok: false,
      motivo: 'Il preventivo non ha imponibile: impossibile valutare il margine.',
      richiedeApprovazione: false,
    }
  }

  return { ok: true }
}

/**
 * Se una versione sia scaduta a una certa data.
 *
 * Senza `validUntil` non scade: e' una scelta consapevole, un preventivo senza
 * termine indicato resta valido finche' qualcuno non decide diversamente.
 */
export function eScaduto(validUntil: Date | null, adesso: Date): boolean {
  if (validUntil === null) return false
  return validUntil.getTime() < adesso.getTime()
}

export type EsitoCliente = 'accettato' | 'rifiutato'

export type EsitoRegistrazione =
  | { readonly ok: true; readonly nuovoStato: StatoVersione }
  | { readonly ok: false; readonly motivo: string }

/** Registra la decisione del cliente su una versione inviata. */
export function registraEsitoCliente(
  stato: StatoVersione,
  esito: EsitoCliente,
  motivoRifiuto: string | null,
): EsitoRegistrazione {
  if (stato !== 'inviato') {
    return {
      ok: false,
      motivo: 'Si può registrare l\'esito solo di una versione inviata al cliente.',
    }
  }

  if (esito === 'rifiutato' && !motivoRifiuto?.trim()) {
    return {
      ok: false,
      motivo: 'Indicare il motivo del rifiuto: senza, non si capisce dove si perde.',
    }
  }

  return { ok: true, nuovoStato: esito }
}
