import { beforeAll, describe, expect, it } from 'vitest'
import { cifra, decifra } from './cifratura'

/**
 * La chiave arriva dall'ambiente. `env()` la legge una volta sola e la mette in
 * cache, quindi va impostata prima del primo accesso.
 */
beforeAll(() => {
  process.env.MFA_SECRET_KEY = 'a'.repeat(64)
  process.env.DATABASE_URL ??= 'postgres://prova'
})

describe('cifratura dei segreti recuperabili', () => {
  it('va e torna', () => {
    const testo = 'JBSWY3DPEHPK3PXP'
    expect(decifra(cifra(testo))).toBe(testo)
  })

  it('due cifrature dello stesso testo sono diverse', () => {
    // IV nuovo a ogni chiamata: riusarlo con GCM non indebolisce un po' la
    // cifratura, la annulla.
    const a = cifra('stesso segreto')
    const b = cifra('stesso segreto')
    expect(a).not.toBe(b)
    expect(decifra(a)).toBe(decifra(b))
  })

  it('rifiuta un testo cifrato manomesso', () => {
    // È il motivo per cui si usa GCM e non CBC: senza autenticazione, una riga
    // alterata produrrebbe un segreto diverso invece di un errore.
    const pacchetto = cifra('segreto')
    const [iv, tag, dati] = pacchetto.split('.')
    const alterato = `${iv}.${tag}.${dati!.slice(0, -2)}AA`
    expect(() => decifra(alterato)).toThrow()
  })

  it('rifiuta un pacchetto malformato', () => {
    for (const rotto of ['', 'a', 'a.b', 'a.b.c.d']) {
      expect(() => decifra(rotto)).toThrow()
    }
  })

  it('rifiuta un IV o un tag di lunghezza sbagliata', () => {
    expect(() => decifra('AAAA.BBBB.CCCC')).toThrow()
  })

  it('regge caratteri non ASCII', () => {
    const testo = 'però — ünïcode 🔐'
    expect(decifra(cifra(testo))).toBe(testo)
  })
})
