import { describe, expect, it } from 'vitest'
import { nomeCartellaCliente, nomeCartellaCommessa, ripulisciNomeCartella } from './nomi'

describe('nome della cartella cliente', () => {
  it('mette il cognome prima del nome', () => {
    // Le cartelle in Drive si ordinano alfabeticamente: un elenco per nome di
    // battesimo non aiuta chi sta cercando un cliente.
    expect(nomeCartellaCliente({ firstName: 'Marco', lastName: 'Rossi' })).toBe(
      'Rossi Marco',
    )
  })

  it('per le aziende mette la ragione sociale, con il referente fra parentesi', () => {
    expect(
      nomeCartellaCliente({
        firstName: 'Anna',
        lastName: 'Verdi',
        companyName: 'Verdi Costruzioni S.r.l.',
      }),
    ).toBe('Verdi Costruzioni S.r.l. (Verdi Anna)')
  })

  it('regge un contatto senza nome di battesimo', () => {
    expect(nomeCartellaCliente({ firstName: null, lastName: 'Rossi' })).toBe('Rossi')
  })

  it('non produce mai un nome vuoto', () => {
    // Una cartella chiamata «» non si ritrova e non si rinomina.
    expect(nomeCartellaCliente({ firstName: '', lastName: '///' })).toBe(
      'Cliente senza nome',
    )
  })
})

describe('nome della cartella commessa', () => {
  it('mette il codice davanti al titolo', () => {
    expect(nomeCartellaCommessa({ code: 'COM-2026-0007', title: 'Impianto 6 kW' })).toBe(
      'COM-2026-0007 — Impianto 6 kW',
    )
  })

  it('resta usabile se il titolo è vuoto', () => {
    expect(nomeCartellaCommessa({ code: 'COM-2026-0007', title: '   ' })).toBe(
      'COM-2026-0007',
    )
  })
})

describe('ripulitura dei nomi', () => {
  it('toglie le barre, che i client di sincronizzazione leggono come cartelle', () => {
    expect(ripulisciNomeCartella('Rossi / Bianchi')).toBe('Rossi Bianchi')
    expect(ripulisciNomeCartella('C:\\clienti')).toBe('C clienti')
  })

  it('conserva trattini, accenti e punteggiatura normale', () => {
    // Sono nomi di persone e di aziende: storpiarli renderebbe la cartella
    // irriconoscibile proprio a chi deve trovarla.
    expect(ripulisciNomeCartella('Rossi-Bianchi & C. S.p.A. però')).toBe(
      'Rossi-Bianchi & C. S.p.A. però',
    )
  })

  it('toglie i caratteri di controllo', () => {
    expect(ripulisciNomeCartella('Rossi\u0000\u001fMario')).toBe('Rossi Mario')
  })

  it('non lascia un punto finale, che alcuni client mangiano', () => {
    expect(ripulisciNomeCartella('Rossi S.r.l...')).toBe('Rossi S.r.l')
  })

  it('accorcia i nomi lunghissimi senza lasciare spazi in coda', () => {
    const lungo = ripulisciNomeCartella('a'.repeat(300))
    expect(lungo).toHaveLength(120)
    expect(lungo).toBe(lungo.trim())
  })
})
