import { describe, expect, it } from 'vitest'
import { compareForDedup, findDuplicates, type DedupSubject } from './dedup'

function soggetto(overrides: Partial<DedupSubject> = {}): DedupSubject {
  return {
    phoneE164: null,
    emailNormalized: null,
    taxCode: null,
    lastName: 'Rossi',
    firstName: 'Mario',
    city: 'La Spezia',
    ...overrides,
  }
}

describe('compareForDedup', () => {
  it('segnala lo stesso telefono come possibile duplicato', () => {
    const risultato = compareForDedup(
      soggetto({ phoneE164: '+393331234567' }),
      soggetto({ phoneE164: '+393331234567', lastName: 'Rossi', firstName: 'M.' }),
    )
    expect(risultato.verdict).toBe('possibile_duplicato')
    expect(risultato.reasons).toContain('telefono')
  })

  it('segnala la stessa email', () => {
    const risultato = compareForDedup(
      soggetto({ emailNormalized: 'mario@example.it' }),
      soggetto({ emailNormalized: 'mario@example.it', lastName: 'Bianchi' }),
    )
    expect(risultato.verdict).toBe('possibile_duplicato')
  })

  it('segnala lo stesso codice fiscale ignorando le maiuscole', () => {
    const risultato = compareForDedup(
      soggetto({ taxCode: 'rssmra80a01e463x' }),
      soggetto({ taxCode: 'RSSMRA80A01E463X', lastName: 'Rossi' }),
    )
    expect(risultato.reasons).toContain('codice_fiscale')
    expect(risultato.score).toBe(100)
  })

  it('NON considera duplicati due contatti che hanno entrambi i campi vuoti', () => {
    // E' l'errore classico: null === null. Due contatti senza telefono ne'
    // email non sono la stessa persona.
    const risultato = compareForDedup(
      soggetto({ lastName: 'Rossi', firstName: 'Mario', city: 'Genova' }),
      soggetto({ lastName: 'Verdi', firstName: 'Luca', city: 'Milano' }),
    )
    expect(risultato.score).toBe(0)
    expect(risultato.verdict).toBe('nessun_duplicato')
  })

  it('non segnala omonimi nello stesso comune senza altri riscontri', () => {
    // "Rossi Mario a La Spezia" sono piu' persone: 55 punti non bastano.
    const risultato = compareForDedup(soggetto(), soggetto())
    expect(risultato.reasons).toEqual(['nome_e_comune'])
    expect(risultato.verdict).toBe('nessun_duplicato')
  })

  it('segnala omonimi nello stesso comune se anche un contatto coincide', () => {
    const risultato = compareForDedup(
      soggetto({ emailNormalized: 'm.rossi@example.it' }),
      soggetto({ emailNormalized: 'm.rossi@example.it' }),
    )
    expect(risultato.score).toBe(100)
    expect(risultato.reasons).toEqual(expect.arrayContaining(['email', 'nome_e_comune']))
  })

  it('ignora accenti e maiuscole nel confronto dei nomi', () => {
    const risultato = compareForDedup(
      soggetto({ lastName: 'DE ANGELIS', firstName: 'Niccolò', phoneE164: '+390187111' }),
      soggetto({ lastName: 'de angelis', firstName: 'Niccolo', phoneE164: '+390187111' }),
    )
    expect(risultato.reasons).toEqual(expect.arrayContaining(['telefono', 'nome_e_comune']))
  })

  it('non supera mai quota 100', () => {
    const identico = soggetto({
      phoneE164: '+393331234567',
      emailNormalized: 'x@y.it',
      taxCode: 'ABC',
    })
    expect(compareForDedup(identico, identico).score).toBe(100)
  })
})

describe('findDuplicates', () => {
  const candidati = [
    { id: 'a', ...soggetto({ phoneE164: '+393331234567' }) },
    { id: 'b', ...soggetto({ lastName: 'Verdi', firstName: 'Luca', city: 'Milano' }) },
    { id: 'c', ...soggetto({ emailNormalized: 'mario@example.it' }) },
  ]

  it('restituisce solo i candidati sopra soglia, ordinati per punteggio', () => {
    const trovati = findDuplicates(
      soggetto({ phoneE164: '+393331234567', emailNormalized: 'mario@example.it' }),
      candidati,
    )
    expect(trovati.map((t) => t.record.id)).toEqual(['a', 'c'])
    expect(trovati[0]!.result.score).toBeGreaterThanOrEqual(trovati[1]!.result.score)
  })

  it('restituisce un elenco vuoto quando non ci sono riscontri', () => {
    const trovati = findDuplicates(
      soggetto({ lastName: 'Neri', firstName: 'Anna', city: 'Torino' }),
      candidati,
    )
    expect(trovati).toEqual([])
  })
})
