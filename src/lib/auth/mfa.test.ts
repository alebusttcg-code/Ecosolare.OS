import { describe, expect, it } from 'vitest'
import { consumaCodiceRecupero, improntaCodiceRecupero, mfaObbligatoria } from './mfa'
import { generaCodiciRecupero, normalizzaCodiceRecupero } from './totp'
import type { Role } from './policy'

describe('mfaObbligatoria', () => {
  it('è disattivata per tutti i ruoli (solo email + password)', () => {
    const ruoli: Role[] = [
      'amministratore',
      'contabilita',
      'commerciale',
      'cantiere',
    ]
    for (const ruolo of ruoli) {
      expect(mfaObbligatoria(ruolo)).toBe(false)
    }
  })
})

describe('codici di recupero (helper legacy)', () => {
  it('consuma un codice una sola volta', () => {
    const codici = generaCodiciRecupero(2)
    const hashes = codici.map((c) =>
      improntaCodiceRecupero(normalizzaCodiceRecupero(c)),
    )
    const dopo = consumaCodiceRecupero(hashes, normalizzaCodiceRecupero(codici[0]!))
    expect(dopo).toHaveLength(1)
    expect(
      consumaCodiceRecupero(dopo!, normalizzaCodiceRecupero(codici[0]!)),
    ).toBeNull()
  })
})
