import { describe, expect, it } from 'vitest'
import { percorsoAppSicuro } from './percorso-app'

describe('percorsoAppSicuro', () => {
  it('accetta path relativi interni', () => {
    expect(percorsoAppSicuro('/agenda/abc')).toBe('/agenda/abc')
    expect(percorsoAppSicuro(' /lead/1 ')).toBe('/lead/1')
  })

  it('rifiuta open-redirect e valori non stringa', () => {
    expect(percorsoAppSicuro('//evil.test')).toBeNull()
    expect(percorsoAppSicuro('https://evil.test')).toBeNull()
    expect(percorsoAppSicuro('/a\\b')).toBeNull()
    expect(percorsoAppSicuro('agenda')).toBeNull()
    expect(percorsoAppSicuro(null)).toBeNull()
  })
})
