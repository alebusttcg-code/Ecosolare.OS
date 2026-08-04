import { normalizeName } from './phone'

/**
 * Rilevazione dei duplicati (US-02.2).
 *
 * REGOLA ASSOLUTA: questo modulo **propone**, non fonde mai. Una fusione
 * automatica sbagliata unisce lo storico di due clienti diversi, ed e' un danno
 * che si scopre mesi dopo e si disfa con difficolta'. Un duplicato segnalato e
 * ignorato, invece, costa trenta secondi a qualcuno.
 */

export interface DedupSubject {
  readonly phoneE164: string | null
  readonly emailNormalized: string | null
  readonly taxCode: string | null
  readonly lastName: string
  readonly firstName?: string | null
  readonly city?: string | null
}

export type DedupReason =
  | 'codice_fiscale'
  | 'telefono'
  | 'email'
  | 'nome_e_comune'

export interface DedupResult {
  readonly score: number
  readonly reasons: readonly DedupReason[]
  readonly verdict: 'nessun_duplicato' | 'possibile_duplicato'
}

/** Sopra questa soglia si chiede conferma a un umano. */
export const SOGLIA_DUPLICATO = 80

const PESI: Record<DedupReason, number> = {
  codice_fiscale: 100,
  telefono: 95,
  email: 90,
  // Da solo non basta: "Rossi a La Spezia" sono molte persone diverse.
  nome_e_comune: 55,
}

/** Confronto fra due valori che sono chiavi solo se entrambi presenti. */
function coincidono(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return a === b
}

export function compareForDedup(
  incoming: DedupSubject,
  existing: DedupSubject,
): DedupResult {
  const reasons: DedupReason[] = []

  if (coincidono(incoming.taxCode?.toUpperCase(), existing.taxCode?.toUpperCase())) {
    reasons.push('codice_fiscale')
  }
  if (coincidono(incoming.phoneE164, existing.phoneE164)) {
    reasons.push('telefono')
  }
  if (coincidono(incoming.emailNormalized, existing.emailNormalized)) {
    reasons.push('email')
  }

  const stessoNome =
    normalizeName(incoming.lastName) === normalizeName(existing.lastName) &&
    normalizeName(incoming.firstName) === normalizeName(existing.firstName)
  const stessoComune = coincidono(
    normalizeName(incoming.city) || null,
    normalizeName(existing.city) || null,
  )
  if (stessoNome && stessoComune) {
    reasons.push('nome_e_comune')
  }

  const score = Math.min(
    100,
    reasons.reduce((totale, reason) => totale + PESI[reason], 0),
  )

  return {
    score,
    reasons,
    verdict: score >= SOGLIA_DUPLICATO ? 'possibile_duplicato' : 'nessun_duplicato',
  }
}

export interface DedupCandidate<T> {
  readonly record: T
  readonly result: DedupResult
}

/**
 * Cerca i possibili duplicati fra i candidati forniti, ordinati per punteggio.
 * Chi chiama e' responsabile di restringere i candidati con una query mirata:
 * qui non si scorre l'intera anagrafica.
 */
export function findDuplicates<T extends DedupSubject & { id: string }>(
  incoming: DedupSubject,
  candidates: readonly T[],
): DedupCandidate<T>[] {
  return candidates
    .map((record) => ({ record, result: compareForDedup(incoming, record) }))
    .filter((c) => c.result.verdict === 'possibile_duplicato')
    .sort((a, b) => b.result.score - a.result.score)
}
