import { describe, expect, it } from 'vitest'
import {
  haDatiPrequalificaPerSopralluogo,
  risposteDaPrequalifica,
  unisciRisposteSopralluogo,
} from './sopralluogo-prequalifica'

describe('sopralluogo-prequalifica', () => {
  it('importa copertura e accumulo dalla prequalifica', () => {
    const r = risposteDaPrequalifica({
      tipo_tetto: 'falda',
      orientamento: 'sud_est',
      superficie_indicativa: 40,
      ombreggiamenti: 'nessuno',
      stato_copertura: 'buono',
      interessi_aggiuntivi: ['accumulo', 'quadro'],
    })
    expect(r).toMatchObject({
      tipo_tetto: 'falda',
      orientamento: 'sud_est',
      superficie_utile: 40,
      ombreggiamenti: 'nessuno',
      stato_copertura: 'buono',
      accumulo_previsto: true,
    })
  })

  it('mappa amianto e ombre importanti', () => {
    const r = risposteDaPrequalifica({
      stato_copertura: 'amianto',
      ombreggiamenti: 'importanti',
    })
    expect(r.amianto).toBe(true)
    expect(r.ombreggiamenti).toBe('costanti')
    expect(r.stato_copertura).toBeUndefined()
  })

  it('ignora orientamento «non so»', () => {
    const r = risposteDaPrequalifica({ orientamento: 'non_so', tipo_tetto: 'piano' })
    expect(r.tipo_tetto).toBe('piano')
    expect(r.orientamento).toBeUndefined()
  })

  it('le risposte salvate nel sopralluogo prevalgono', () => {
    const daPrequal = risposteDaPrequalifica({ tipo_tetto: 'falda', superficie_indicativa: 30 })
    const unite = unisciRisposteSopralluogo(daPrequal, { superficie_utile: 42 })
    expect(unite.superficie_utile).toBe(42)
    expect(unite.tipo_tetto).toBe('falda')
  })

  it('rileva se ci sono dati importabili', () => {
    expect(haDatiPrequalificaPerSopralluogo({})).toBe(false)
    expect(haDatiPrequalificaPerSopralluogo({ tipo_tetto: 'piano' })).toBe(true)
  })
})
