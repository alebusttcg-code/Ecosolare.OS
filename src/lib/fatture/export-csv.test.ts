import { describe, expect, it } from 'vitest'
import { csvRegistroFatture, nomeFileRegistro, type RigaRegistro } from './export-csv'

const base: RigaRegistro = {
  numero: '2026/0001',
  data: new Date(Date.UTC(2026, 7, 3)), // 3 agosto 2026
  tipo: 'fattura',
  cliente: 'Mario Rossi',
  codiceFiscale: 'RSSMRA80A01H501U',
  partitaIva: null,
  imponibileCents: 100_000,
  impostaCents: 10_000,
  totaleCents: 110_000,
  aliquote: [10],
}

describe('registro fatture CSV', () => {
  it('intestazione e una riga, con numeri e data all’italiana', () => {
    const csv = csvRegistroFatture([base])
    const righe = csv.split('\r\n')
    expect(righe[0]).toBe(
      'Numero;Data;Tipo;Cliente;Codice fiscale;Partita IVA;Imponibile;Imposta;Totale;Aliquote',
    )
    expect(righe[1]).toBe(
      '2026/0001;03/08/2026;fattura;Mario Rossi;RSSMRA80A01H501U;;1000,00;100,00;1100,00;10%',
    )
  })

  it('mette fra virgolette i campi con separatore o virgolette', () => {
    const csv = csvRegistroFatture([
      { ...base, cliente: 'Rossi; Bianchi e "C." S.r.l.' },
    ])
    expect(csv.split('\r\n')[1]).toContain('"Rossi; Bianchi e ""C."" S.r.l."')
  })

  it('campi nulli restano vuoti, non «null»', () => {
    const csv = csvRegistroFatture([{ ...base, codiceFiscale: null, data: null }])
    const campi = csv.split('\r\n')[1]!.split(';')
    expect(campi[1]).toBe('') // data
    expect(campi[4]).toBe('') // codice fiscale
  })

  it('una nota di credito porta gli importi in negativo', () => {
    const csv = csvRegistroFatture([
      { ...base, tipo: 'nota_credito', imponibileCents: -100_000, impostaCents: -10_000, totaleCents: -110_000 },
    ])
    expect(csv).toContain('-1000,00;-100,00;-1100,00')
  })

  it('il nome file riporta il periodo', () => {
    expect(nomeFileRegistro(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 11, 31)))).toBe(
      'registro-fatture_2026-01-01_2026-12-31.csv',
    )
  })
})
