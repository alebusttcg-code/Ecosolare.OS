import { describe, expect, it } from 'vitest'
import { parseIntakePayload } from './intake'

describe('parseIntakePayload', () => {
  it('accetta i nomi di campo italiani', () => {
    const esito = parseIntakePayload({
      nome: 'Mario',
      cognome: 'Rossi',
      telefono: '333 123 4567',
      messaggio: 'Vorrei un preventivo per il fotovoltaico',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.lead.firstName).toBe('Mario')
    expect(esito.lead.lastName).toBe('Rossi')
    expect(esito.lead.phoneE164).toBe('+393331234567')
  })

  it('accetta i nomi di campo inglesi e le varianti', () => {
    const esito = parseIntakePayload({
      first_name: 'Anna',
      lastName: 'Verdi',
      'e-mail': 'ANNA@Example.IT',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.lead.firstName).toBe('Anna')
    expect(esito.lead.lastName).toBe('Verdi')
    expect(esito.lead.emailNormalized).toBe('anna@example.it')
  })

  it('scompone un nome completo quando i campi separati non ci sono', () => {
    const esito = parseIntakePayload({
      nome_completo: 'Luca De Angelis',
      email: 'luca@example.it',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.lead.firstName).toBe('Luca De')
    expect(esito.lead.lastName).toBe('Angelis')
  })

  it('rifiuta un lead senza nominativo', () => {
    const esito = parseIntakePayload({ email: 'anonimo@example.it' })
    expect(esito.ok).toBe(false)
  })

  it('rifiuta un lead senza recapiti utilizzabili', () => {
    const esito = parseIntakePayload({ cognome: 'Rossi', telefono: 'chiamare in ufficio' })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.motivo).toContain('recapito')
  })

  it('rifiuta un corpo che non e un oggetto', () => {
    expect(parseIntakePayload('testo').ok).toBe(false)
    expect(parseIntakePayload(null).ok).toBe(false)
    expect(parseIntakePayload([1, 2]).ok).toBe(false)
  })

  it('riconosce la linea di business dal messaggio', () => {
    const idraulico = parseIntakePayload({
      cognome: 'Rossi',
      telefono: '3331234567',
      messaggio: 'Ho un problema con la caldaia',
    })
    expect(idraulico.ok && idraulico.lead.businessLine).toBe('idraulico')

    const elettrico = parseIntakePayload({
      cognome: 'Rossi',
      telefono: '3331234567',
      servizio: 'Colonnina di ricarica',
    })
    expect(elettrico.ok && elettrico.lead.businessLine).toBe('elettrico')
  })

  it('usa il fotovoltaico come default in assenza di indizi', () => {
    const esito = parseIntakePayload({ cognome: 'Rossi', telefono: '3331234567' })
    expect(esito.ok && esito.lead.businessLine).toBe('fotovoltaico')
  })

  it('conserva l identificativo esterno per l idempotenza', () => {
    const esito = parseIntakePayload({
      cognome: 'Rossi',
      telefono: '3331234567',
      submission_id: 'form-2026-0042',
    })
    expect(esito.ok && esito.lead.externalId).toBe('form-2026-0042')
  })

  it('ignora i campi sconosciuti senza fallire', () => {
    const esito = parseIntakePayload({
      cognome: 'Rossi',
      telefono: '3331234567',
      campo_strano: { annidato: true },
      utm_campaign: 'estate-2026',
    })
    expect(esito.ok).toBe(true)
  })
})
