import { describe, expect, it } from 'vitest'
import {
  DIMENSIONE_MASSIMA,
  formattaDimensione,
  riconosciTipo,
  ripulisciNome,
  validaFile,
} from './upload'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
const script = new TextEncoder().encode('<?php system($_GET["c"]); ?>')

describe('riconosciTipo', () => {
  it('riconosce i tre formati ammessi dai byte iniziali', () => {
    expect(riconosciTipo(jpeg)).toBe('image/jpeg')
    expect(riconosciTipo(png)).toBe('image/png')
    expect(riconosciTipo(pdf)).toBe('application/pdf')
  })

  it('rifiuta i formati non ammessi', () => {
    expect(riconosciTipo(gif)).toBeNull()
    expect(riconosciTipo(script)).toBeNull()
  })

  it('rifiuta un file troppo corto per contenere una firma', () => {
    expect(riconosciTipo(new Uint8Array([0xff]))).toBeNull()
    expect(riconosciTipo(new Uint8Array([]))).toBeNull()
  })
})

describe('validaFile', () => {
  it('accetta un PDF valido', () => {
    const esito = validaFile({
      byte: pdf,
      dimensione: 2048,
      tipoDichiarato: 'application/pdf',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.tipo).toBe('application/pdf')
    expect(esito.estensione).toBe('pdf')
  })

  it('SMASCHERA un file che mente sul proprio tipo', () => {
    // È il caso che conta: uno script rinominato .pdf e dichiarato PDF.
    // Il browser dice "application/pdf", i byte dicono altro. Vincono i byte.
    const esito = validaFile({
      byte: script,
      dimensione: script.length,
      tipoDichiarato: 'application/pdf',
    })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.motivo).toContain('Formato non riconosciuto')
  })

  it('accetta un file il cui tipo dichiarato è sbagliato ma il contenuto è valido', () => {
    // Alcuni browser dichiarano male i JPEG: se i byte sono buoni, si accetta
    // il contenuto reale invece di rifiutare un documento legittimo.
    const esito = validaFile({
      byte: jpeg,
      dimensione: 5000,
      tipoDichiarato: 'application/octet-stream',
    })
    expect(esito.ok).toBe(true)
    if (!esito.ok) return
    expect(esito.tipo).toBe('image/jpeg')
  })

  it('rifiuta un file vuoto', () => {
    const esito = validaFile({ byte: new Uint8Array([]), dimensione: 0, tipoDichiarato: '' })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.motivo).toContain('vuoto')
  })

  it('rifiuta un file oltre il limite di dimensione', () => {
    const esito = validaFile({
      byte: pdf,
      dimensione: DIMENSIONE_MASSIMA + 1,
      tipoDichiarato: 'application/pdf',
    })
    expect(esito.ok).toBe(false)
    if (esito.ok) return
    expect(esito.motivo).toContain('limite')
  })

  it('accetta esattamente il limite', () => {
    expect(
      validaFile({ byte: pdf, dimensione: DIMENSIONE_MASSIMA, tipoDichiarato: 'application/pdf' })
        .ok,
    ).toBe(true)
  })

  it('rifiuta un GIF, che non è fra i formati previsti', () => {
    expect(validaFile({ byte: gif, dimensione: 100, tipoDichiarato: 'image/gif' }).ok).toBe(
      false,
    )
  })
})

describe('ripulisciNome', () => {
  it('toglie i percorsi, tenendo solo il nome', () => {
    expect(ripulisciNome('../../etc/passwd')).toBe('passwd')
    expect(ripulisciNome('C:\\Users\\mario\\bolletta.pdf')).toBe('bolletta.pdf')
    expect(ripulisciNome('/tmp/foto.jpg')).toBe('foto.jpg')
  })

  it('toglie i caratteri problematici', () => {
    expect(ripulisciNome('fatt<ura>:"2026".pdf')).toBe('fattura2026.pdf')
  })

  it('non restituisce mai una stringa vuota', () => {
    expect(ripulisciNome('')).toBe('documento')
    expect(ripulisciNome('///')).toBe('documento')
  })

  it('accorcia i nomi lunghissimi', () => {
    expect(ripulisciNome('a'.repeat(400)).length).toBeLessThanOrEqual(120)
  })

  it('conserva i nomi normali, accenti compresi', () => {
    expect(ripulisciNome('Visura catastale — Rossi.pdf')).toBe(
      'Visura catastale — Rossi.pdf',
    )
  })
})

describe('formattaDimensione', () => {
  it('sceglie l unità leggibile', () => {
    expect(formattaDimensione(512)).toBe('512 B')
    expect(formattaDimensione(2048)).toBe('2 KB')
    expect(formattaDimensione(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
