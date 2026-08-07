import { describe, expect, it } from 'vitest'
import { bloccoFinoA, durataBlocco, minutiResidui, TENTATIVI_LIBERI } from './tentativi'

describe('blocco progressivo dei tentativi', () => {
  it('non blocca finché si tratta di errori di digitazione', () => {
    for (let n = 0; n <= TENTATIVI_LIBERI; n += 1) {
      expect(durataBlocco(n)).toBe(0)
    }
  })

  it('parte da un minuto e raddoppia', () => {
    expect(durataBlocco(TENTATIVI_LIBERI + 1)).toBe(60_000)
    expect(durataBlocco(TENTATIVI_LIBERI + 2)).toBe(120_000)
    expect(durataBlocco(TENTATIVI_LIBERI + 3)).toBe(240_000)
  })

  it('si ferma a mezz’ora e non cresce oltre', () => {
    // Senza tetto, dopo qualche decina di tentativi il blocco durerebbe anni:
    // sarebbe un modo per chiudere fuori una persona conoscendone solo l'email.
    expect(durataBlocco(TENTATIVI_LIBERI + 10)).toBe(30 * 60_000)
    expect(durataBlocco(TENTATIVI_LIBERI + 1000)).toBe(30 * 60_000)
  })

  it('non produce una scadenza finché non c’è blocco', () => {
    const adesso = new Date('2026-03-01T10:00:00Z')
    expect(bloccoFinoA(TENTATIVI_LIBERI, adesso)).toBeNull()
    expect(bloccoFinoA(TENTATIVI_LIBERI + 1, adesso)).toEqual(
      new Date('2026-03-01T10:01:00Z'),
    )
  })

  it('arrotonda l’attesa per eccesso e non mostra mai zero minuti', () => {
    const adesso = new Date('2026-03-01T10:00:00Z')
    expect(minutiResidui(new Date('2026-03-01T10:00:01Z'), adesso)).toBe(1)
    expect(minutiResidui(new Date('2026-03-01T10:04:30Z'), adesso)).toBe(5)
  })
})
