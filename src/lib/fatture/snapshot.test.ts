import { describe, expect, it } from 'vitest'
import { componiSnapshotCliente, datiFiscaliMancanti } from './snapshot'

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
    const s = componiSnapshotCliente({ firstName: 'Mario', lastName: 'Rossi', taxCode: 'RSSMRA…' }, azienda)
    expect(s.tipo).toBe('azienda')
    expect(s.denominazione).toBe('Rossi Impianti S.r.l.')
    expect(s.partitaIva).toBe('01234567890')
    expect(s.codiceDestinatario).toBe('ABCDEF1')
    expect(s.citta).toBe('Sarzana')
  })

  it('B2C: nome + cognome e codice fiscale, indirizzo assente (limite noto)', () => {
    const s = componiSnapshotCliente({ firstName: 'Mario', lastName: 'Rossi', taxCode: 'RSSMRA80A01H501U' }, null)
    expect(s.tipo).toBe('persona')
    expect(s.denominazione).toBe('Mario Rossi')
    expect(s.codiceFiscale).toBe('RSSMRA80A01H501U')
    expect(s.partitaIva).toBeNull()
    expect(s.indirizzo).toBeNull()
  })

  it('la denominazione regge un contatto senza nome di battesimo', () => {
    const s = componiSnapshotCliente({ firstName: null, lastName: 'Rossi', taxCode: null }, null)
    expect(s.denominazione).toBe('Rossi')
  })

  it('emettibile solo con denominazione e un identificativo fiscale', () => {
    const conCf = componiSnapshotCliente({ firstName: 'Mario', lastName: 'Rossi', taxCode: 'RSSMRA…' }, null)
    expect(datiFiscaliMancanti(conCf)).toEqual([])

    const senzaFiscale = componiSnapshotCliente({ firstName: 'Mario', lastName: 'Rossi', taxCode: null }, null)
    expect(datiFiscaliMancanti(senzaFiscale)).toContain('il codice fiscale o la partita IVA')
  })
})
