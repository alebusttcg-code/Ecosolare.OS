import { afterEach, describe, expect, it } from 'vitest'
import { ambienteServerlessPdf } from './lancia-chromium'

describe('ambienteServerlessPdf', () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it('rileva Vercel', () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    process.env.VERCEL = '1'
    expect(ambienteServerlessPdf()).toBe(true)
  })

  it('rileva AWS Lambda', () => {
    delete process.env.VERCEL
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'fn'
    expect(ambienteServerlessPdf()).toBe(true)
  })

  it('resta falso in locale', () => {
    delete process.env.VERCEL
    delete process.env.AWS_LAMBDA_FUNCTION_NAME
    expect(ambienteServerlessPdf()).toBe(false)
  })
})
