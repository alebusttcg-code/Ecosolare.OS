/**
 * Regole della pipeline commerciale (§5.4 del brief).
 *
 * Gli stati sono configurabili e vivono nel database; le REGOLE che li governano
 * vivono qui, nel backend applicativo (ADR-002). La distinzione conta: dopo
 * l'audit si aggiungeranno o rinomineranno stati senza toccare il codice, ma
 * l'invariante "nessuna opportunita' aperta senza prossima azione" non deve
 * poter essere disattivata da una configurazione.
 */

export interface StageDefinition {
  readonly code: string
  readonly label: string
  readonly sortOrder: number
  readonly isOpen: boolean
  readonly isWon: boolean
  readonly isLost: boolean
  readonly defaultProbability: number
  readonly isActive: boolean
}

export interface OpportunityState {
  readonly stage: string
  readonly nextActionDueAt: Date | null
  readonly lostReason: string | null
  readonly closedAt: Date | null
}

export type ViolationCode =
  | 'stato_sconosciuto'
  | 'stato_non_attivo'
  | 'prossima_azione_mancante'
  | 'motivo_perdita_mancante'

export interface Violation {
  readonly code: ViolationCode
  readonly field: string
  readonly message: string
}

export function findStage(
  code: string,
  stages: readonly StageDefinition[],
): StageDefinition | undefined {
  return stages.find((s) => s.code === code)
}

/**
 * Verifica gli invarianti di un'opportunita'.
 *
 * Il primo e' la regola piu' importante dell'MVP (§16.3): un'opportunita' aperta
 * senza prossima azione e' il modo in cui una pipeline si svuota da sola senza
 * che nessuno se ne accorga.
 */
export function validateOpportunityState(
  state: OpportunityState,
  stages: readonly StageDefinition[],
): Violation[] {
  const violations: Violation[] = []
  const stage = findStage(state.stage, stages)

  if (!stage) {
    return [
      {
        code: 'stato_sconosciuto',
        field: 'stage',
        message: `Lo stato "${state.stage}" non esiste.`,
      },
    ]
  }

  if (!stage.isActive) {
    violations.push({
      code: 'stato_non_attivo',
      field: 'stage',
      message: `Lo stato "${stage.label}" non e piu utilizzabile.`,
    })
  }

  if (stage.isOpen && state.nextActionDueAt === null) {
    violations.push({
      code: 'prossima_azione_mancante',
      field: 'nextActionDueAt',
      message:
        'Ogni opportunita aperta deve avere una prossima azione con una scadenza.',
    })
  }

  if (stage.isLost && !state.lostReason?.trim()) {
    violations.push({
      code: 'motivo_perdita_mancante',
      field: 'lostReason',
      message:
        'Indicare il motivo della perdita: senza, non e possibile capire dove si perde.',
    })
  }

  return violations
}

export interface StageChangePatch {
  readonly stage: string
  readonly stageSince: Date
  readonly probability: number
  readonly nextActionDueAt: Date | null
  readonly closedAt: Date | null
  readonly lostReason: string | null
}

export interface StageChangeHistory {
  readonly fromStage: string
  readonly toStage: string
  readonly daysInPreviousStage: number
  readonly note: string | null
}

export type StageChangeOutcome =
  | { readonly ok: true; readonly patch: StageChangePatch; readonly history: StageChangeHistory }
  | { readonly ok: false; readonly violations: readonly Violation[] }

export interface StageChangeInput {
  readonly current: OpportunityState & { readonly stageSince: Date; readonly probability: number }
  readonly toStage: string
  readonly nextActionDueAt?: Date | null
  readonly lostReason?: string | null
  readonly note?: string | null
  readonly now: Date
}

/**
 * Calcola l'effetto di un cambio di stato, senza applicarlo.
 *
 * Funzione pura: chi la chiama scrive nel database solo se `ok` e' vero. Tenere
 * separati calcolo e scrittura permette di testare tutte le combinazioni senza
 * database e di mostrare gli errori all'utente prima di aver toccato nulla.
 */
export function planStageChange(
  input: StageChangeInput,
  stages: readonly StageDefinition[],
): StageChangeOutcome {
  const destinazione = findStage(input.toStage, stages)

  if (!destinazione) {
    return {
      ok: false,
      violations: [
        {
          code: 'stato_sconosciuto',
          field: 'stage',
          message: `Lo stato "${input.toStage}" non esiste.`,
        },
      ],
    }
  }

  const chiuso = destinazione.isWon || destinazione.isLost

  const proposto: OpportunityState = {
    stage: input.toStage,
    // Uscendo da uno stato aperto la prossima azione non serve piu'.
    nextActionDueAt: chiuso ? null : (input.nextActionDueAt ?? input.current.nextActionDueAt),
    lostReason: destinazione.isLost
      ? (input.lostReason ?? input.current.lostReason)
      : null,
    closedAt: chiuso ? input.now : null,
  }

  const violations = validateOpportunityState(proposto, stages)
  if (violations.length > 0) return { ok: false, violations }

  const millisecondiInUnGiorno = 86_400_000
  const giorni = Math.max(
    0,
    Math.floor(
      (input.now.getTime() - input.current.stageSince.getTime()) / millisecondiInUnGiorno,
    ),
  )

  return {
    ok: true,
    patch: {
      stage: input.toStage,
      stageSince: input.now,
      // La probabilita' segue lo stato, salvo che l'operatore l'abbia forzata.
      probability: destinazione.defaultProbability,
      nextActionDueAt: proposto.nextActionDueAt,
      closedAt: proposto.closedAt,
      lostReason: proposto.lostReason,
    },
    history: {
      fromStage: input.current.stage,
      toStage: input.toStage,
      daysInPreviousStage: giorni,
      note: input.note?.trim() || null,
    },
  }
}

/** Gli stati aperti, in ordine di avanzamento: e' l'ordine della pipeline. */
export function openStages(stages: readonly StageDefinition[]): StageDefinition[] {
  return stages
    .filter((s) => s.isOpen && s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Un'opportunita' e' in ritardo se la prossima azione e' scaduta. */
export function isOverdue(state: OpportunityState, now: Date): boolean {
  return state.nextActionDueAt !== null && state.nextActionDueAt.getTime() < now.getTime()
}
