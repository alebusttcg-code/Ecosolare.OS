/**
 * Sequenze di follow-up commerciali (D-014).
 *
 * Pre-sopralluogo: fissare il sopralluogo. Post-sopralluogo: chiudere il contratto.
 * Massimo 2+2, a +2 e +4 giorni dalla data ancora. Pure: niente DB.
 */

export const FASE_PRE = 'pre_sopralluogo' as const
export const FASE_POST = 'post_sopralluogo' as const

export type FaseFollowUp = typeof FASE_PRE | typeof FASE_POST

export const GIORNI_FOLLOW_UP = [2, 4] as const

export const OUTCOME_SALTATO_SOPRALLUOGO = 'saltato_sopralluogo_fissato'
export const OUTCOME_SALTATO_FIRMA = 'saltato_contratto_firmato'

export interface PassoFollowUp {
  readonly phase: FaseFollowUp
  readonly step: 1 | 2
  readonly dueAt: Date
  readonly subject: string
  readonly kind: 'chiamata'
}

function aggiungiGiorni(da: Date, giorni: number): Date {
  return new Date(da.getTime() + giorni * 86_400_000)
}

/** Due passi pre-sopralluogo da data di acquisizione lead. */
export function scadenzePre(acquisizione: Date): readonly PassoFollowUp[] {
  return [
    {
      phase: FASE_PRE,
      step: 1,
      dueAt: aggiungiGiorni(acquisizione, GIORNI_FOLLOW_UP[0]),
      subject: 'Follow-up: fissare sopralluogo',
      kind: 'chiamata',
    },
    {
      phase: FASE_PRE,
      step: 2,
      dueAt: aggiungiGiorni(acquisizione, GIORNI_FOLLOW_UP[1]),
      subject: 'Follow-up: sollecito sopralluogo',
      kind: 'chiamata',
    },
  ]
}

/** Due passi post-sopralluogo da chiusura checklist. */
export function scadenzePost(chiusuraSopralluogo: Date): readonly PassoFollowUp[] {
  return [
    {
      phase: FASE_POST,
      step: 1,
      dueAt: aggiungiGiorni(chiusuraSopralluogo, GIORNI_FOLLOW_UP[0]),
      subject: 'Follow-up: preventivo e chiusura contratto',
      kind: 'chiamata',
    },
    {
      phase: FASE_POST,
      step: 2,
      dueAt: aggiungiGiorni(chiusuraSopralluogo, GIORNI_FOLLOW_UP[1]),
      subject: 'Follow-up: sollecito chiusura contratto',
      kind: 'chiamata',
    },
  ]
}

export function etichettaFase(phase: string): string {
  if (phase === FASE_PRE) return 'Pre-sopralluogo'
  if (phase === FASE_POST) return 'Post-sopralluogo'
  if (phase === 'manuale') return 'Follow-up'
  return phase
}

/** True se l’attività appartiene a una sequenza follow-up. */
export function eFollowUp(a: {
  readonly followUpPhase?: string | null
  readonly followUpStep?: number | null
}): boolean {
  return a.followUpPhase != null && a.followUpStep != null
}
