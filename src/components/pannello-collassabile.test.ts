import { describe, expect, it } from 'vitest'
import { deveAprirePerHash } from './pannello-collassabile'

describe('deveAprirePerHash', () => {
  it('apre su #documenti', () => {
    expect(deveAprirePerHash('#documenti', 'documenti', 'documento')).toBe(true)
    expect(deveAprirePerHash('documenti', 'documenti', 'documento')).toBe(true)
  })

  it('apre su #documento-*', () => {
    expect(deveAprirePerHash('#documento-titolo_proprieta', 'documenti', 'documento')).toBe(
      true,
    )
    expect(deveAprirePerHash('documento-visura', 'documenti', 'documento')).toBe(true)
  })

  it('non apre su ancore di altre sezioni', () => {
    expect(deveAprirePerHash('#materiali', 'documenti', 'documento')).toBe(false)
    expect(deveAprirePerHash('#materiale-abc', 'documenti', 'documento')).toBe(false)
    expect(deveAprirePerHash('#pratiche', 'documenti', 'documento')).toBe(false)
    expect(deveAprirePerHash('', 'documenti', 'documento')).toBe(false)
  })

  it('senza prefisso apre solo sull’id del pannello', () => {
    expect(deveAprirePerHash('#documenti', 'documenti')).toBe(true)
    expect(deveAprirePerHash('#documento-x', 'documenti')).toBe(false)
  })
})
