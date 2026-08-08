import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PolicySubject } from './policy'

const findFirstTask = vi.fn()

vi.mock('@/db', () => ({
  getDb: () => ({
    query: {
      projectTasks: { findFirst: findFirstTask },
    },
  }),
}))

import { assertCommessaInScope } from '@/lib/auth/scope-query'

const installatore: PolicySubject & { id: string } = {
  id: 'installatore-id',
  role: 'cantiere',
  isFieldOnly: true,
  canViewCosts: false,
  isActive: true,
}

const commerciale: PolicySubject & { id: string } = {
  id: 'commerciale-id',
  role: 'commerciale',
  isFieldOnly: false,
  canViewCosts: false,
  isActive: true,
}

describe('assertCommessaInScope', () => {
  beforeEach(() => {
    findFirstTask.mockReset()
  })

  it('consente ai ruoli da scrivania senza interrogare i task', async () => {
    await expect(assertCommessaInScope(commerciale, 'commessa-altra')).resolves.toBeUndefined()
    expect(findFirstTask).not.toHaveBeenCalled()
  })

  it('nega al field-only una commessa senza task assegnato', async () => {
    findFirstTask.mockResolvedValueOnce(undefined)

    await expect(assertCommessaInScope(installatore, 'commessa-altra')).rejects.toThrow(
      'Accesso non consentito',
    )
    expect(findFirstTask).toHaveBeenCalledOnce()
  })

  it('consente al field-only una commessa con task assegnato', async () => {
    findFirstTask.mockResolvedValueOnce({ id: 'task-id' })

    await expect(assertCommessaInScope(installatore, 'commessa-assegnata')).resolves.toBeUndefined()
  })
})
