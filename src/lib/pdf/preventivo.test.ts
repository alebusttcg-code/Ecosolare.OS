import { describe, expect, it } from 'vitest'
import {
  formattaEuroDb,
  formattaPrezzoUnitario,
  formattaQuantita,
  nomeFilePreventivo,
} from './dati-preventivo'
import { ECOSOLARE } from '@/lib/brand/ecosolare'

describe('nomeFilePreventivo', () => {
  it('produce un nome sicuro e leggibile', () => {
    expect(nomeFilePreventivo('PRV-2026-0007', 2)).toBe('Preventivo-PRV-2026-0007-v2.pdf')
  })

  it('ripulisce caratteri non sicuri nel codice', () => {
    expect(nomeFilePreventivo('PRV 2026/01', 1)).toBe('Preventivo-PRV-2026-01-v1.pdf')
  })
})

describe('formattazione PDF', () => {
  it('formatta gli importi in euro italiani', () => {
    expect(formattaEuroDb('1234.56')).toMatch(/1\.?234,56\s*€/)
  })

  it('formatta prezzi unitari con fino a quattro decimali', () => {
    expect(formattaPrezzoUnitario('0.1234')).toMatch(/0,1234/)
  })

  it('formatta quantità senza zeri inutili', () => {
    expect(formattaQuantita('6.000')).toBe('6')
    expect(formattaQuantita('1.500')).toBe('1,5')
  })
})

describe('biglietto da visita EcoSolare', () => {
  it('include il sito istituzionale e entrambe le sedi', () => {
    expect(ECOSOLARE.sito).toBe('www.ecosolare.biz')
    expect(ECOSOLARE.sitoUrl).toBe('https://www.ecosolare.biz/')
    expect(ECOSOLARE.email).toBe('info@ecosolare.biz')
    expect(ECOSOLARE.sedi).toHaveLength(2)
    expect(ECOSOLARE.sedi[0]?.nome).toContain('La Spezia')
    expect(ECOSOLARE.sedi[0]?.via).toContain('Buonviaggio')
    expect(ECOSOLARE.sedi[1]?.nome).toContain('Bologna')
    expect(ECOSOLARE.sedi[1]?.capCitta).toContain('San Giovanni in Persiceto')
  })

  it('non espone campi di costo nel DTO brand', () => {
    // Garanzia di prodotto: il modulo brand non parla di margini o costi.
    expect(JSON.stringify(ECOSOLARE)).not.toMatch(/costo|margine|unitCost/i)
  })

  it('definisce la palette PDF commerciale chiara', () => {
    expect(ECOSOLARE.pdf.carta).toBe('#ffffff')
    expect('abisso' in ECOSOLARE.pdf).toBe(false)
    expect(ECOSOLARE.pdf.verde).toMatch(/^#/)
    expect(ECOSOLARE.trust.length).toBeGreaterThanOrEqual(2)
  })
})
