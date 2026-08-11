import { describe, expect, it } from 'vitest'
import { consumaCodiceRecupero, improntaCodiceRecupero, mfaObbligatoria } from './mfa'
import { generaCodiciRecupero, normalizzaCodiceRecupero } from './totp'
import { ALL_ROLES } from './policy'

describe('chi deve avere la verifica in due passaggi', () => {
  it('è obbligatoria per amministratore e contabilità', () => {
    expect(mfaObbligatoria('amministratore')).toBe(true)
    expect(mfaObbligatoria('contabilita')).toBe(true)
  })

  it('non lo è per commerciale e cantiere', () => {
    // Imporla a chi entra dal telefono in cantiere, con la rete che va e
    // viene, produce solo persone che smettono di usare il sistema.
    expect(mfaObbligatoria('commerciale')).toBe(false)
    expect(mfaObbligatoria('cantiere')).toBe(false)
  })

  it('decide per ogni ruolo esistente', () => {
    // Un ruolo nuovo deve essere considerato di proposito, non per omissione.
    for (const ruolo of ALL_ROLES) {
      expect(typeof mfaObbligatoria(ruolo)).toBe('boolean')
    }
  })
})

describe('codici di recupero', () => {
  const codici = generaCodiciRecupero()
  const impronte = codici.map((c) => improntaCodiceRecupero(normalizzaCodiceRecupero(c)))

  it('un codice valido viene accettato e sparisce dall’elenco', () => {
    const rimasti = consumaCodiceRecupero(impronte, normalizzaCodiceRecupero(codici[3]!))
    expect(rimasti).not.toBeNull()
    expect(rimasti).toHaveLength(impronte.length - 1)
    expect(rimasti).not.toContain(impronte[3])
  })

  it('lo stesso codice non vale due volte', () => {
    // Un codice di recupero riutilizzabile è una password su un foglietto.
    const dopoPrimo = consumaCodiceRecupero(impronte, normalizzaCodiceRecupero(codici[0]!))!
    expect(consumaCodiceRecupero(dopoPrimo, normalizzaCodiceRecupero(codici[0]!))).toBeNull()
  })

  it('un codice inventato non passa', () => {
    expect(consumaCodiceRecupero(impronte, 'AAAAAAAAAA')).toBeNull()
  })

  it('accetta il codice trascritto con trattini, spazi o minuscole', () => {
    // Viene letto da un foglio stampato: chi lo ricopia non è preciso.
    const originale = codici[5]!
    for (const forma of [
      originale.toLowerCase(),
      originale.replace('-', ' '),
      originale.replace('-', ''),
    ]) {
      expect(
        consumaCodiceRecupero(impronte, normalizzaCodiceRecupero(forma)),
      ).not.toBeNull()
    }
  })

  it('un elenco vuoto non accetta niente', () => {
    expect(consumaCodiceRecupero([], normalizzaCodiceRecupero(codici[0]!))).toBeNull()
  })

  it('l’impronta non lascia risalire al codice', () => {
    const impronta = improntaCodiceRecupero('ABCDEFGHJK')
    expect(impronta).toHaveLength(64)
    expect(impronta).not.toContain('ABCDE')
  })
})
