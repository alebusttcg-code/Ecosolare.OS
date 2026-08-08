import { describe, expect, it } from 'vitest'
import {
  eConcluso,
  eScaduto,
  puoEliminarePreventivo,
  puoInviare,
  puoModificare,
  registraEsitoCliente,
  type StatoVersione,
} from './quote-lifecycle'

const TUTTI: StatoVersione[] = [
  'bozza',
  'in_approvazione',
  'approvato',
  'inviato',
  'accettato',
  'rifiutato',
  'scaduto',
]

describe('puoEliminarePreventivo', () => {
  it('consente l eliminazione solo prima dell invio al cliente', () => {
    expect(puoEliminarePreventivo('bozza')).toBe(true)
    expect(puoEliminarePreventivo('in_approvazione')).toBe(true)
    expect(puoEliminarePreventivo('approvato')).toBe(true)
    expect(puoEliminarePreventivo('inviato')).toBe(false)
    expect(puoEliminarePreventivo('accettato')).toBe(false)
    expect(puoEliminarePreventivo('rifiutato')).toBe(false)
    expect(puoEliminarePreventivo('scaduto')).toBe(false)
  })
})

describe('puoModificare', () => {
  it('consente la modifica solo in bozza', () => {
    expect(puoModificare('bozza')).toBe(true)
    for (const stato of TUTTI.filter((s) => s !== 'bozza')) {
      expect(puoModificare(stato), stato).toBe(false)
    }
  })

  it('blocca la modifica di una versione inviata al cliente', () => {
    // La regola contrattuale: il cliente ha in mano un PDF con quei numeri.
    expect(puoModificare('inviato')).toBe(false)
    expect(puoModificare('accettato')).toBe(false)
  })

  it('blocca la modifica mentre e in approvazione', () => {
    // Altrimenti si potrebbe far approvare un preventivo e cambiarlo dopo.
    expect(puoModificare('in_approvazione')).toBe(false)
  })

  it('blocca la modifica di una versione approvata', () => {
    expect(puoModificare('approvato')).toBe(false)
  })
})

describe('puoInviare', () => {
  it('consente l invio di una bozza sopra soglia', () => {
    expect(puoInviare({ stato: 'bozza', esitoSoglia: 'sopra_soglia', haRighe: true }).ok).toBe(
      true,
    )
  })

  it('richiede approvazione sotto soglia, senza vietare', () => {
    const esito = puoInviare({ stato: 'bozza', esitoSoglia: 'sotto_soglia', haRighe: true })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.richiedeApprovazione).toBe(true)
  })

  it('consente l invio dopo l approvazione, anche sotto soglia', () => {
    expect(
      puoInviare({ stato: 'approvato', esitoSoglia: 'sotto_soglia', haRighe: true }).ok,
    ).toBe(true)
  })

  it('rifiuta un preventivo senza righe', () => {
    const esito = puoInviare({ stato: 'bozza', esitoSoglia: 'sopra_soglia', haRighe: false })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.richiedeApprovazione).toBe(false)
  })

  it('rifiuta un preventivo senza imponibile', () => {
    const esito = puoInviare({ stato: 'bozza', esitoSoglia: 'non_valutabile', haRighe: true })
    expect(esito.ok).toBe(false)
  })

  it('rifiuta il reinvio di una versione gia inviata', () => {
    const esito = puoInviare({ stato: 'inviato', esitoSoglia: 'sopra_soglia', haRighe: true })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.richiedeApprovazione).toBe(false)
  })

  it('rifiuta l invio di una versione in attesa di approvazione', () => {
    expect(
      puoInviare({ stato: 'in_approvazione', esitoSoglia: 'sotto_soglia', haRighe: true }).ok,
    ).toBe(false)
  })
})

describe('eScaduto', () => {
  const adesso = new Date('2026-08-04T10:00:00Z')

  it('riconosce una validita superata', () => {
    expect(eScaduto(new Date('2026-07-31T10:00:00Z'), adesso)).toBe(true)
  })

  it('non considera scaduta una validita futura', () => {
    expect(eScaduto(new Date('2026-09-01T10:00:00Z'), adesso)).toBe(false)
  })

  it('non fa scadere un preventivo senza termine indicato', () => {
    expect(eScaduto(null, adesso)).toBe(false)
  })
})

describe('registraEsitoCliente', () => {
  it('accetta una versione inviata', () => {
    const esito = registraEsitoCliente('inviato', 'accettato', null)
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.nuovoStato).toBe('accettato')
  })

  it('richiede il motivo per registrare un rifiuto', () => {
    expect(registraEsitoCliente('inviato', 'rifiutato', null).ok).toBe(false)
    expect(registraEsitoCliente('inviato', 'rifiutato', '   ').ok).toBe(false)
    expect(registraEsitoCliente('inviato', 'rifiutato', 'Prezzo').ok).toBe(true)
  })

  it('non registra esiti su versioni mai inviate', () => {
    expect(registraEsitoCliente('bozza', 'accettato', null).ok).toBe(false)
    expect(registraEsitoCliente('approvato', 'accettato', null).ok).toBe(false)
  })

  it('non registra due volte lo stesso esito', () => {
    expect(registraEsitoCliente('accettato', 'accettato', null).ok).toBe(false)
  })
})

describe('eConcluso', () => {
  it('riconosce gli stati conclusi', () => {
    for (const stato of ['accettato', 'rifiutato', 'scaduto'] as const) {
      expect(eConcluso(stato), stato).toBe(true)
    }
    for (const stato of ['bozza', 'in_approvazione', 'approvato', 'inviato'] as const) {
      expect(eConcluso(stato), stato).toBe(false)
    }
  })
})
