import { describe, expect, it } from 'vitest'
import {
  componiSnapshotCliente,
  datiFiscaliMancanti,
  type ContattoFiscale,
} from './snapshot'

function persona(over: Partial<ContattoFiscale> = {}): ContattoFiscale {
  return {
    firstName: 'Mario',
    lastName: 'Rossi',
    taxCode: 'RSSMRA80A01H501U',
    addressLine: null,
    city: null,
    province: null,
    postalCode: null,
    ...over,
  }
}

const azienda = {
  legalName: 'Rossi Impianti S.r.l.',
  vatNumber: '01234567890',
  taxCode: '01234567890',
  pec: 'rossi@pec.it',
  sdiCode: 'ABCDEF1',
  addressLine: 'Via Roma 1',
  city: 'Sarzana',
  province: 'SP',
  postalCode: '19038',
}

describe('snapshot fiscale del cliente', () => {
  it('B2B: prende tutto dall’azienda (P.IVA, PEC, codice destinatario)', () => {
    const s = componiSnapshotCliente(persona(), azienda)
    expect(s.tipo).toBe('azienda')
    expect(s.denominazione).toBe('Rossi Impianti S.r.l.')
    expect(s.partitaIva).toBe('01234567890')
    expect(s.codiceDestinatario).toBe('ABCDEF1')
    expect(s.citta).toBe('Sarzana')
  })

  it('B2C: nome, codice fiscale e indirizzo del contatto', () => {
    const s = componiSnapshotCliente(
      persona({ addressLine: 'Via Barcola 13', city: 'Lerici', province: 'SP', postalCode: '19032' }),
      null,
    )
    expect(s.tipo).toBe('persona')
    expect(s.denominazione).toBe('Mario Rossi')
    expect(s.codiceFiscale).toBe('RSSMRA80A01H501U')
    expect(s.partitaIva).toBeNull()
    expect(s.indirizzo).toBe('Via Barcola 13')
    expect(s.cap).toBe('19032')
  })

  it('la denominazione regge un contatto senza nome di battesimo', () => {
    expect(componiSnapshotCliente(persona({ firstName: null }), null).denominazione).toBe('Rossi')
  })

  it('emettibile solo con denominazione e un identificativo fiscale', () => {
    expect(datiFiscaliMancanti(componiSnapshotCliente(persona(), null))).toEqual([])
    expect(
      datiFiscaliMancanti(componiSnapshotCliente(persona({ taxCode: null }), null)),
    ).toContain('il codice fiscale o la partita IVA')
  })
})
