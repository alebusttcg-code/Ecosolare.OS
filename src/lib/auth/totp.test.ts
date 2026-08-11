import { describe, expect, it } from 'vitest'
import {
  base32Codifica,
  base32Decodifica,
  codicePerPasso,
  generaCodiciRecupero,
  generaSegretoTotp,
  normalizzaCodiceRecupero,
  passoDi,
  segretoLeggibile,
  uriOtpauth,
  verificaCodiceTotp,
} from './totp'

/**
 * I vettori di prova dell'RFC 6238, appendice B.
 *
 * Il segreto è la stringa ASCII `12345678901234567890`. Provare contro questi
 * numeri è l'unico modo per sapere che l'implementazione è davvero TOTP e non
 * qualcosa che le somiglia: se sbagliassimo, il codice del telefono non
 * combacerebbe mai e lo scopriremmo addosso al primo utente.
 */
const SEGRETO_RFC = base32Codifica(Buffer.from('12345678901234567890', 'ascii'))

describe('conformità all’RFC 6238', () => {
  const vettori: readonly [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ]

  for (const [secondi, atteso] of vettori) {
    it(`t=${secondi} produce ${atteso}`, () => {
      const passo = Math.floor(secondi / 30)
      expect(codicePerPasso(SEGRETO_RFC, passo)).toBe(atteso)
    })
  }
})

describe('base32', () => {
  it('va e torna senza perdere byte', () => {
    for (const testo of ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'ciao mondo']) {
      const dati = Buffer.from(testo, 'utf8')
      expect(base32Decodifica(base32Codifica(dati))).toEqual(dati)
    }
  })

  it('accetta il segreto ricopiato con gli spazi', () => {
    // È mostrato a gruppi di quattro: chi lo trascrive porta dietro gli spazi.
    const segreto = generaSegretoTotp()
    expect(base32Decodifica(segretoLeggibile(segreto))).toEqual(
      base32Decodifica(segreto),
    )
  })

  it('rifiuta i caratteri che non appartengono all’alfabeto', () => {
    expect(() => base32Decodifica('ABC!')).toThrow()
  })
})

describe('verifica del codice', () => {
  const adesso = new Date('2026-08-11T12:00:00Z')
  const segreto = generaSegretoTotp()
  const corrente = passoDi(adesso)

  it('accetta il codice del momento', () => {
    const codice = codicePerPasso(segreto, corrente)
    expect(verificaCodiceTotp({ segretoBase32: segreto, codice, adesso })).toEqual({
      valido: true,
      passo: corrente,
    })
  })

  it('tollera un passo di scarto, in entrambe le direzioni', () => {
    // L'orologio del telefono non è mai esattamente il nostro.
    for (const scarto of [-1, 1]) {
      const codice = codicePerPasso(segreto, corrente + scarto)
      expect(
        verificaCodiceTotp({ segretoBase32: segreto, codice, adesso }).valido,
      ).toBe(true)
    }
  })

  it('rifiuta oltre la tolleranza', () => {
    for (const scarto of [-2, 2, 10]) {
      const codice = codicePerPasso(segreto, corrente + scarto)
      expect(
        verificaCodiceTotp({ segretoBase32: segreto, codice, adesso }).valido,
      ).toBe(false)
    }
  })

  it('non accetta due volte lo stesso codice', () => {
    // Chi legge il codice sopra la spalla avrebbe altrimenti trenta secondi
    // per usarlo prima del legittimo proprietario.
    const codice = codicePerPasso(segreto, corrente)
    const primo = verificaCodiceTotp({ segretoBase32: segreto, codice, adesso })
    expect(primo.valido).toBe(true)

    const secondo = verificaCodiceTotp({
      segretoBase32: segreto,
      codice,
      adesso,
      ultimoPassoUsato: primo.passo,
    })
    expect(secondo.valido).toBe(false)
  })

  it('rifiuta anche i passi precedenti a uno già speso', () => {
    const codicePrecedente = codicePerPasso(segreto, corrente - 1)
    expect(
      verificaCodiceTotp({
        segretoBase32: segreto,
        codice: codicePrecedente,
        adesso,
        ultimoPassoUsato: corrente,
      }).valido,
    ).toBe(false)
  })

  it('rifiuta ciò che non è un codice a sei cifre', () => {
    for (const codice of ['', '12345', '1234567', 'abcdef', '12 34 56 78']) {
      expect(
        verificaCodiceTotp({ segretoBase32: segreto, codice, adesso }).valido,
      ).toBe(false)
    }
  })

  it('accetta il codice scritto con gli spazi', () => {
    const codice = codicePerPasso(segreto, corrente)
    const conSpazi = `${codice.slice(0, 3)} ${codice.slice(3)}`
    expect(
      verificaCodiceTotp({ segretoBase32: segreto, codice: conSpazi, adesso }).valido,
    ).toBe(true)
  })

  it('due segreti diversi non producono lo stesso codice', () => {
    const altro = generaSegretoTotp()
    expect(codicePerPasso(segreto, corrente)).not.toBe(codicePerPasso(altro, corrente))
  })
})

describe('indirizzo otpauth', () => {
  it('contiene segreto, emittente e parametri', () => {
    const uri = uriOtpauth({ segretoBase32: 'ABCDEFGH', email: 'mario@ecosolare.it' })
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain('secret=ABCDEFGH')
    expect(uri).toContain('issuer=EcoSolare')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })

  it('codifica l’etichetta, che contiene i due punti', () => {
    const uri = uriOtpauth({ segretoBase32: 'AB', email: 'a@b.it' })
    expect(uri).not.toMatch(/totp\/EcoSolare OS:/)
  })
})

describe('codici di recupero', () => {
  it('ne genera dieci, tutti diversi', () => {
    const codici = generaCodiciRecupero()
    expect(codici).toHaveLength(10)
    expect(new Set(codici).size).toBe(10)
  })

  it('hanno la stessa forma e non usano caratteri ambigui', () => {
    for (const codice of generaCodiciRecupero()) {
      expect(codice).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/)
      expect(codice).not.toMatch(/[0O1I]/)
    }
  })

  it('la normalizzazione perdona trattini, spazi e minuscole', () => {
    expect(normalizzaCodiceRecupero('abcde-fghjk')).toBe('ABCDEFGHJK')
    expect(normalizzaCodiceRecupero('ABCDE FGHJK')).toBe('ABCDEFGHJK')
  })
})
