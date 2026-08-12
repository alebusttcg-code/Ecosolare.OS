'use server'

import type { ActionResult } from './opportunities'

/**
 * La verifica in due passaggi non è più disponibile (accesso solo email +
 * password). Le action restano come stub tipizzati per non rompere eventuali
 * import residui; rispondono sempre con errore esplicito.
 */

const DISATTIVATA =
  'La verifica in due passaggi non è più attiva. Accesso con email e password.'

export async function preparaMfa(): Promise<
  ActionResult<{ segreto: string; segretoLeggibile: string; uri: string }>
> {
  return { ok: false, errors: { _: DISATTIVATA } }
}

export async function attivaMfa(
  _input: { codice: string },
): Promise<ActionResult<{ codiciRecupero: string[] }>> {
  void _input
  return { ok: false, errors: { _: DISATTIVATA } }
}

export async function disattivaMfa(
  _input: { password: string },
): Promise<ActionResult<{ ok: true }>> {
  void _input
  return { ok: false, errors: { _: DISATTIVATA } }
}

export async function rigeneraCodiciRecuperoMfa(
  _input: { password: string },
): Promise<ActionResult<{ codiciRecupero: string[] }>> {
  void _input
  return { ok: false, errors: { _: DISATTIVATA } }
}

export async function azzeraMfaUtente(
  _input: { userId: string },
): Promise<ActionResult<{ ok: true }>> {
  void _input
  return { ok: false, errors: { _: DISATTIVATA } }
}
