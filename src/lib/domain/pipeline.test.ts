import { describe, expect, it } from 'vitest'
import {
  isOverdue,
  openStages,
  planStageChange,
  validateOpportunityState,
  type StageDefinition,
} from './pipeline'

const STAGES: StageDefinition[] = [
  { code: 'nuovo', label: 'Nuovo', sortOrder: 10, isOpen: true, isWon: false, isLost: false, defaultProbability: 5, isActive: true },
  { code: 'contattato', label: 'Contattato', sortOrder: 20, isOpen: true, isWon: false, isLost: false, defaultProbability: 15, isActive: true },
  { code: 'qualificato', label: 'Qualificato', sortOrder: 30, isOpen: true, isWon: false, isLost: false, defaultProbability: 30, isActive: true },
  { code: 'vinto', label: 'Vinto', sortOrder: 100, isOpen: false, isWon: true, isLost: false, defaultProbability: 100, isActive: true },
  { code: 'perso', label: 'Perso', sortOrder: 110, isOpen: false, isWon: false, isLost: true, defaultProbability: 0, isActive: true },
  { code: 'dismesso', label: 'Stato dismesso', sortOrder: 120, isOpen: true, isWon: false, isLost: false, defaultProbability: 0, isActive: false },
]

const ORA = new Date('2026-08-04T10:00:00Z')
const FRA_TRE_GIORNI = new Date('2026-08-07T10:00:00Z')

describe('validateOpportunityState', () => {
  it("impedisce un'opportunita aperta senza prossima azione", () => {
    const violazioni = validateOpportunityState(
      { stage: 'contattato', nextActionDueAt: null, lostReason: null, closedAt: null },
      STAGES,
    )
    expect(violazioni).toHaveLength(1)
    expect(violazioni[0]?.code).toBe('prossima_azione_mancante')
  })

  it('accetta un opportunita aperta con prossima azione', () => {
    const violazioni = validateOpportunityState(
      {
        stage: 'contattato',
        nextActionDueAt: FRA_TRE_GIORNI,
        lostReason: null,
        closedAt: null,
      },
      STAGES,
    )
    expect(violazioni).toEqual([])
  })

  it('non richiede la prossima azione su uno stato chiuso', () => {
    const violazioni = validateOpportunityState(
      { stage: 'vinto', nextActionDueAt: null, lostReason: null, closedAt: ORA },
      STAGES,
    )
    expect(violazioni).toEqual([])
  })

  it('richiede il motivo quando si perde', () => {
    const violazioni = validateOpportunityState(
      { stage: 'perso', nextActionDueAt: null, lostReason: null, closedAt: ORA },
      STAGES,
    )
    expect(violazioni.map((v) => v.code)).toEqual(['motivo_perdita_mancante'])
  })

  it('non accetta un motivo di perdita fatto di soli spazi', () => {
    const violazioni = validateOpportunityState(
      { stage: 'perso', nextActionDueAt: null, lostReason: '   ', closedAt: ORA },
      STAGES,
    )
    expect(violazioni.map((v) => v.code)).toEqual(['motivo_perdita_mancante'])
  })

  it('segnala uno stato inesistente', () => {
    const violazioni = validateOpportunityState(
      { stage: 'inventato', nextActionDueAt: null, lostReason: null, closedAt: null },
      STAGES,
    )
    expect(violazioni.map((v) => v.code)).toEqual(['stato_sconosciuto'])
  })

  it('segnala uno stato disattivato', () => {
    const violazioni = validateOpportunityState(
      {
        stage: 'dismesso',
        nextActionDueAt: FRA_TRE_GIORNI,
        lostReason: null,
        closedAt: null,
      },
      STAGES,
    )
    expect(violazioni.map((v) => v.code)).toEqual(['stato_non_attivo'])
  })
})

describe('planStageChange', () => {
  const corrente = {
    stage: 'nuovo',
    stageSince: new Date('2026-08-01T10:00:00Z'),
    probability: 5,
    nextActionDueAt: FRA_TRE_GIORNI,
    lostReason: null,
    closedAt: null,
  }

  it('avanza di stato e calcola i giorni trascorsi nel precedente', () => {
    const esito = planStageChange(
      { current: corrente, toStage: 'contattato', now: ORA },
      STAGES,
    )
    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    expect(esito.patch.stage).toBe('contattato')
    expect(esito.patch.probability).toBe(15)
    expect(esito.patch.stageSince).toEqual(ORA)
    expect(esito.history.daysInPreviousStage).toBe(3)
    expect(esito.history.fromStage).toBe('nuovo')
  })

  it('rifiuta il passaggio a uno stato aperto senza prossima azione', () => {
    const senzaAzione = { ...corrente, nextActionDueAt: null }
    const esito = planStageChange(
      { current: senzaAzione, toStage: 'qualificato', now: ORA },
      STAGES,
    )
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.violations.map((v) => v.code)).toEqual(['prossima_azione_mancante'])
  })

  it('accetta il passaggio se la prossima azione viene fornita contestualmente', () => {
    const senzaAzione = { ...corrente, nextActionDueAt: null }
    const esito = planStageChange(
      {
        current: senzaAzione,
        toStage: 'qualificato',
        nextActionDueAt: FRA_TRE_GIORNI,
        now: ORA,
      },
      STAGES,
    )
    expect(esito.ok).toBe(true)
  })

  it('chiudendo come vinto azzera la prossima azione e registra la chiusura', () => {
    const esito = planStageChange({ current: corrente, toStage: 'vinto', now: ORA }, STAGES)
    expect(esito.ok).toBe(true)
    if (!esito.ok) return

    expect(esito.patch.nextActionDueAt).toBeNull()
    expect(esito.patch.closedAt).toEqual(ORA)
    expect(esito.patch.probability).toBe(100)
    expect(esito.patch.lostReason).toBeNull()
  })

  it('rifiuta la chiusura come perso senza motivo', () => {
    const esito = planStageChange({ current: corrente, toStage: 'perso', now: ORA }, STAGES)
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.violations.map((v) => v.code)).toEqual(['motivo_perdita_mancante'])
  })

  it('accetta la chiusura come perso con il motivo', () => {
    const esito = planStageChange(
      { current: corrente, toStage: 'perso', lostReason: 'Prezzo', now: ORA },
      STAGES,
    )
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.patch.lostReason).toBe('Prezzo')
    expect(esito.patch.closedAt).toEqual(ORA)
  })

  it('riaprendo un opportunita persa cancella il motivo di perdita', () => {
    const persa = {
      ...corrente,
      stage: 'perso',
      lostReason: 'Prezzo',
      closedAt: ORA,
      nextActionDueAt: null,
    }
    const esito = planStageChange(
      {
        current: persa,
        toStage: 'contattato',
        nextActionDueAt: FRA_TRE_GIORNI,
        now: ORA,
      },
      STAGES,
    )
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.patch.lostReason).toBeNull()
    expect(esito.patch.closedAt).toBeNull()
  })

  it('non produce giorni negativi se le date sono incoerenti', () => {
    const futuro = { ...corrente, stageSince: new Date('2026-09-01T10:00:00Z') }
    const esito = planStageChange(
      { current: futuro, toStage: 'contattato', now: ORA },
      STAGES,
    )
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.history.daysInPreviousStage).toBe(0)
  })

  it('segnala uno stato di destinazione inesistente', () => {
    const esito = planStageChange(
      { current: corrente, toStage: 'inventato', now: ORA },
      STAGES,
    )
    expect(esito.ok).toBe(false)
  })
})

describe('openStages', () => {
  it('restituisce solo gli stati aperti e attivi, in ordine', () => {
    expect(openStages(STAGES).map((s) => s.code)).toEqual([
      'nuovo',
      'contattato',
      'qualificato',
    ])
  })
})

describe('isOverdue', () => {
  const base = { stage: 'nuovo', lostReason: null, closedAt: null }

  it('riconosce una prossima azione scaduta', () => {
    expect(
      isOverdue({ ...base, nextActionDueAt: new Date('2026-08-01T10:00:00Z') }, ORA),
    ).toBe(true)
  })

  it('non considera in ritardo una scadenza futura', () => {
    expect(isOverdue({ ...base, nextActionDueAt: FRA_TRE_GIORNI }, ORA)).toBe(false)
  })

  it('non considera in ritardo un opportunita senza scadenza', () => {
    expect(isOverdue({ ...base, nextActionDueAt: null }, ORA)).toBe(false)
  })
})
