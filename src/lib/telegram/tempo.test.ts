import { describe, expect, it } from 'vitest'
import { eOraDiReminderFollowUp, giornoRoma, oraRoma } from './tempo'

describe('giornoRoma', () => {
  it('formatta YYYY-MM-DD', () => {
    // Mezzogiorno UTC è sempre lo stesso giorno civile in Italia (CET/CEST).
    expect(giornoRoma(new Date('2026-08-10T12:00:00.000Z'))).toBe('2026-08-10')
  })
})

describe('oraRoma', () => {
  it('restituisce un’ora tra 0 e 23', () => {
    const ora = oraRoma(new Date('2026-08-10T12:00:00.000Z'))
    expect(ora).toBeGreaterThanOrEqual(0)
    expect(ora).toBeLessThanOrEqual(23)
  })
})

describe('eOraDiReminderFollowUp', () => {
  it('false se la scadenza è un altro giorno', () => {
    const due = new Date('2026-08-10T10:00:00.000Z')
    const adesso = new Date('2026-08-11T10:00:00.000Z')
    expect(eOraDiReminderFollowUp(due, adesso)).toBe(false)
  })

  it('false prima delle 08:00 Roma nello stesso giorno', () => {
    // 05:00 UTC in agosto = 07:00 CEST — sotto soglia.
    const due = new Date('2026-08-10T08:00:00.000Z')
    const adesso = new Date('2026-08-10T05:00:00.000Z')
    expect(eOraDiReminderFollowUp(due, adesso)).toBe(false)
  })

  it('true dallo stesso giorno dopo le 08:00 Roma', () => {
    // 07:00 UTC in agosto = 09:00 CEST.
    const due = new Date('2026-08-10T08:00:00.000Z')
    const adesso = new Date('2026-08-10T07:00:00.000Z')
    expect(eOraDiReminderFollowUp(due, adesso)).toBe(true)
  })
})
