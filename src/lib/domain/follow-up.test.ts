import { describe, expect, it } from 'vitest'
import {
  FASE_POST,
  FASE_PRE,
  GIORNI_FOLLOW_UP,
  eFollowUp,
  scadenzePost,
  scadenzePre,
} from './follow-up'

describe('scadenzePre', () => {
  it('crea due passi a +2 e +4 giorni dall’acquisizione', () => {
    const acquisizione = new Date('2026-08-10T10:00:00.000Z')
    const passi = scadenzePre(acquisizione)
    expect(passi).toHaveLength(2)
    expect(passi[0]?.phase).toBe(FASE_PRE)
    expect(passi[0]?.step).toBe(1)
    expect(passi[0]?.dueAt.getTime()).toBe(
      acquisizione.getTime() + GIORNI_FOLLOW_UP[0] * 86_400_000,
    )
    expect(passi[1]?.step).toBe(2)
    expect(passi[1]?.dueAt.getTime()).toBe(
      acquisizione.getTime() + GIORNI_FOLLOW_UP[1] * 86_400_000,
    )
  })
})

describe('scadenzePost', () => {
  it('crea due passi a +2 e +4 giorni dalla chiusura sopralluogo', () => {
    const chiusura = new Date('2026-08-20T15:00:00.000Z')
    const passi = scadenzePost(chiusura)
    expect(passi).toHaveLength(2)
    expect(passi[0]?.phase).toBe(FASE_POST)
    expect(passi[0]?.dueAt.getTime()).toBe(
      chiusura.getTime() + GIORNI_FOLLOW_UP[0] * 86_400_000,
    )
    expect(passi[1]?.dueAt.getTime()).toBe(
      chiusura.getTime() + GIORNI_FOLLOW_UP[1] * 86_400_000,
    )
  })
})

describe('eFollowUp', () => {
  it('riconosce i metadati di sequenza', () => {
    expect(eFollowUp({ followUpPhase: FASE_PRE, followUpStep: 1 })).toBe(true)
    expect(eFollowUp({ followUpPhase: null, followUpStep: null })).toBe(false)
    expect(eFollowUp({})).toBe(false)
  })
})
