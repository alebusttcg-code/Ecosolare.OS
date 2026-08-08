import { describe, expect, it } from 'vitest'
import { normalizzaPod, validaPod, validaPodOpzionale } from './pod'

describe('normalizzaPod', () => {
  it('rimuove spazi e porta in maiuscolo', () => {
    expect(normalizzaPod(' it001e12345678 ')).toBe('IT001E12345678')
    expect(normalizzaPod('IT 001 E 12345678')).toBe('IT001E12345678')
  })
})

describe('validaPod', () => {
  it('accetta 14 e 15 caratteri alfanumerici', () => {
    expect(validaPod('IT001E12345678').ok).toBe(true)
    expect(validaPod('IT001E123456789').ok).toBe(true)
  })

  it('rifiuta lunghezze errate', () => {
    expect(validaPod('IT001E1234567').ok).toBe(false)
    expect(validaPod('IT001E1234567890').ok).toBe(false)
  })

  it('rifiuta caratteri non ammessi', () => {
    expect(validaPod('IT001E-12345678').ok).toBe(false)
    expect(validaPod('IT001E1234567!').ok).toBe(false)
  })
})

describe('validaPodOpzionale', () => {
  it('accetta il vuoto', () => {
    expect(validaPodOpzionale('').ok).toBe(true)
    expect(validaPodOpzionale('   ').ok).toBe(true)
  })
})
