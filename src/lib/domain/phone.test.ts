import { describe, expect, it } from 'vitest'
import { normalizeEmail, normalizeName, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('riconduce allo stesso E.164 le scritture equivalenti di un mobile', () => {
    const attese = '+393331234567'
    for (const variante of [
      '3331234567',
      '333 123 4567',
      '333-123-4567',
      '333.123.4567',
      '+39 333 1234567',
      '+393331234567',
      '0039 333 1234567',
      '39 333 1234567',
      '  3331234567  ',
      '(333) 1234567',
    ]) {
      expect(normalizePhone(variante).e164, variante).toBe(attese)
    }
  })

  it('normalizza i numeri fissi italiani', () => {
    expect(normalizePhone('0187 123456').e164).toBe('+390187123456')
    expect(normalizePhone('+39 0187 123456').e164).toBe('+390187123456')
  })

  it('conserva i numeri esteri senza trattarli come italiani', () => {
    expect(normalizePhone('+33 6 12 34 56 78').e164).toBe('+33612345678')
    expect(normalizePhone('+1 415 555 0100').e164).toBe('+14155550100')
  })

  it('restituisce null invece di indovinare, quando il numero non e riconoscibile', () => {
    for (const input of ['', '   ', 'n/d', '12345', 'chiamare in ufficio', '+', '++39333']) {
      expect(normalizePhone(input).e164, input).toBeNull()
    }
  })

  it('non scambia per prefisso internazionale un numero che inizia per 39', () => {
    // 39 seguito da cifre non plausibili come numero italiano: non e' +39.
    expect(normalizePhone('3912').e164).toBeNull()
  })

  it('conserva sempre il valore originale', () => {
    const risultato = normalizePhone(' 333 / 123 4567 ')
    expect(risultato.raw).toBe('333 / 123 4567')
    expect(risultato.e164).toBe('+393331234567')
  })

  it('gestisce input assenti', () => {
    expect(normalizePhone(null).e164).toBeNull()
    expect(normalizePhone(undefined).e164).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('porta in minuscolo e toglie gli spazi', () => {
    expect(normalizeEmail('  Mario.Rossi@Example.IT ')).toBe('mario.rossi@example.it')
  })

  it('rifiuta valori che non sono indirizzi', () => {
    expect(normalizeEmail('non ho email')).toBeNull()
    expect(normalizeEmail('@example.it')).toBeNull()
    expect(normalizeEmail('mario@')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

describe('normalizeName', () => {
  it('ignora accenti, maiuscole e spazi multipli', () => {
    expect(normalizeName('  Niccolò   DE  ANGELIS ')).toBe('niccolo de angelis')
    expect(normalizeName('Bosè')).toBe(normalizeName('BOSE'))
  })
})
