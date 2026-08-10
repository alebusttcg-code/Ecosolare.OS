import { describe, expect, it } from 'vitest'
import {
  ALL_ACTIONS,
  ALL_RESOURCES,
  ALL_ROLES,
  AuthorizationError,
  authorize,
  can,
  scopeFor,
  type PolicySubject,
  type Role,
} from './policy'

function subject(role: Role, overrides: Partial<PolicySubject> = {}): PolicySubject {
  return {
    role,
    canViewCosts: role === 'amministratore' || role === 'contabilita',
    isFieldOnly: false,
    isActive: true,
    ...overrides,
  }
}

const admin = subject('amministratore')
const contabilita = subject('contabilita')
const commerciale = subject('commerciale')
const cantiere = subject('cantiere')

describe("regola: un utente disattivato non puo' nulla", () => {
  it.each(ALL_ROLES)('nega ogni azione a un %s disattivato', (role) => {
    const disattivato = subject(role, { isActive: false, canViewCosts: true })
    for (const resource of ALL_RESOURCES) {
      for (const action of ALL_ACTIONS) {
        expect(can(disattivato, action, resource)).toBe(false)
      }
    }
  })
})

describe('regola: i costi non si vedono senza can_view_costs', () => {
  it("nega i costi di preventivo al commerciale senza capacita'", () => {
    expect(can(commerciale, 'read', 'quote_cost')).toBe(false)
  })

  it("concede i costi al commerciale con la capacita' attiva", () => {
    const abilitato = subject('commerciale', { canViewCosts: true })
    expect(can(abilitato, 'read', 'quote_cost')).toBe(true)
  })

  it("concede i costi di commessa al responsabile cantieri con la capacita'", () => {
    const responsabile = subject('cantiere', { canViewCosts: true })
    expect(can(responsabile, 'read', 'project_economics')).toBe(true)
    expect(can(cantiere, 'read', 'project_economics')).toBe(false)
  })

  it('non permette MAI di scrivere attraverso una risorsa di costo', () => {
    const abilitato = subject('commerciale', { canViewCosts: true })
    for (const action of ['create', 'update', 'delete', 'approve'] as const) {
      expect(can(abilitato, action, 'quote_cost')).toBe(false)
      expect(can(abilitato, action, 'material_cost')).toBe(false)
    }
  })

  it("da' i costi a contabilita e amministratore per ruolo, non per flag", () => {
    const senzaFlag = subject('contabilita', { canViewCosts: false })
    expect(can(senzaFlag, 'read', 'quote_cost')).toBe(true)
    expect(
      can(subject('amministratore', { canViewCosts: false }), 'read', 'quote_cost'),
    ).toBe(true)
  })
})

describe("regola: solo l'amministratore approva", () => {
  it("concede l'approvazione dei preventivi al solo amministratore", () => {
    expect(can(admin, 'approve', 'quote_approval')).toBe(true)
    for (const s of [contabilita, commerciale, cantiere]) {
      expect(can(s, 'approve', 'quote_approval')).toBe(false)
    }
  })

  it("non concede l'approvazione nemmeno con can_view_costs attivo", () => {
    const commercialeConCosti = subject('commerciale', { canViewCosts: true })
    expect(can(commercialeConCosti, 'approve', 'quote_approval')).toBe(false)
  })
})

describe("regola: configurazioni, utenti e audit sono solo dell'amministratore", () => {
  it.each(['settings', 'user', 'audit_log', 'integration'] as const)(
    "riserva %s all'amministratore",
    (resource) => {
      expect(can(admin, 'read', resource)).toBe(true)
      for (const s of [contabilita, commerciale, cantiere]) {
        expect(can(s, 'read', resource)).toBe(false)
      }
    },
  )

  it("non permette a nessuno di modificare l'audit log, nemmeno all'amministratore", () => {
    for (const action of ['create', 'update', 'delete'] as const) {
      expect(can(admin, action, 'audit_log')).toBe(false)
    }
  })
})

describe("regola: l'anagrafica e' leggibile da tutti i ruoli", () => {
  it.each(ALL_ROLES)('permette a %s di leggere i contatti', (role) => {
    expect(can(subject(role), 'read', 'contact')).toBe(true)
  })

  it("vale anche per l'installatore in campo: senza cliente non arriva sul posto", () => {
    const installatore = subject('cantiere', { isFieldOnly: true })
    expect(can(installatore, 'read', 'contact')).toBe(true)
  })
})

describe('sezione Sviluppo (Solar)', () => {
  it('è usabile da amministratore e commerciale', () => {
    expect(can(admin, 'update', 'sviluppo')).toBe(true)
    expect(can(commerciale, 'update', 'sviluppo')).toBe(true)
  })

  it('è negata a contabilità e cantiere', () => {
    expect(can(contabilita, 'read', 'sviluppo')).toBe(false)
    expect(can(cantiere, 'read', 'sviluppo')).toBe(false)
  })
})

describe('separazione fra commerciale e cantiere', () => {
  it("impedisce al cantiere di scrivere preventivi e opportunita'", () => {
    expect(can(cantiere, 'update', 'quote')).toBe(false)
    expect(can(cantiere, 'read', 'opportunity')).toBe(false)
    expect(can(cantiere, 'create', 'lead_intake')).toBe(false)
  })

  it('impedisce al commerciale di toccare materiali e ore', () => {
    expect(can(commerciale, 'read', 'material')).toBe(false)
    expect(can(commerciale, 'create', 'time_entry')).toBe(false)
  })

  it('impedisce al cantiere di accedere a fatture e incassi', () => {
    for (const action of ALL_ACTIONS) {
      expect(can(cantiere, action, 'invoice')).toBe(false)
    }
  })

  it('permette al commerciale di vedere lo stato incassi ma non di modificarlo', () => {
    expect(can(commerciale, 'read', 'invoice')).toBe(true)
    expect(can(commerciale, 'update', 'invoice')).toBe(false)
  })
})

describe("capacita' is_field_only", () => {
  const installatore = subject('cantiere', { isFieldOnly: true })

  it("concede solo cio' che serve in cantiere", () => {
    expect(can(installatore, 'create', 'time_entry')).toBe(true)
    expect(can(installatore, 'update', 'survey')).toBe(true)
    expect(can(installatore, 'read', 'project')).toBe(true)
    expect(can(installatore, 'read', 'document')).toBe(true)
  })

  it("nega tutto il resto, anche cio' che il ruolo cantiere avrebbe", () => {
    expect(can(installatore, 'update', 'project')).toBe(false)
    expect(can(installatore, 'read', 'material')).toBe(false)
    expect(can(installatore, 'update', 'schedule')).toBe(false)
    expect(can(installatore, 'read', 'quote')).toBe(false)
    expect(can(installatore, 'read', 'practice')).toBe(false)
  })

  it("nega gli importi anche se la capacita' sui costi fosse attiva per errore", () => {
    const conCosti = subject('cantiere', { isFieldOnly: true, canViewCosts: true })
    expect(can(conCosti, 'read', 'quote_cost')).toBe(false)
    expect(can(conCosti, 'read', 'project_economics')).toBe(false)
    expect(can(conCosti, 'read', 'material_cost')).toBe(false)
  })

  it('limita lo scope alle sole righe assegnate', () => {
    expect(scopeFor(installatore, 'project')).toBe('assigned')
    expect(scopeFor(cantiere, 'project')).toBe('all')
  })
})

describe('scope per riga', () => {
  it('non applica siloing interno al ruolo (sezione 11.5)', () => {
    expect(scopeFor(commerciale, 'opportunity')).toBe('all')
    expect(scopeFor(cantiere, 'schedule')).toBe('all')
  })

  it("restituisce none dove la lettura e' negata", () => {
    expect(scopeFor(commerciale, 'settings')).toBe('none')
    expect(scopeFor(cantiere, 'invoice')).toBe('none')
  })
})

describe('authorize()', () => {
  it("non solleva quando l'azione e' consentita", () => {
    expect(() => authorize(admin, 'update', 'settings')).not.toThrow()
  })

  it("solleva AuthorizationError quando non lo e'", () => {
    expect(() => authorize(commerciale, 'update', 'settings')).toThrow(AuthorizationError)
  })

  it('non rivela nel messaggio il motivo del diniego', () => {
    try {
      authorize(commerciale, 'read', 'audit_log')
      expect.unreachable('doveva sollevare')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError)
      expect((error as AuthorizationError).message).toBe('Accesso non consentito')
      // I dettagli restano sull'oggetto, per il log, non nel messaggio.
      expect((error as AuthorizationError).resource).toBe('audit_log')
    }
  })
})

describe('completezza della matrice', () => {
  it('definisce ogni risorsa per ogni ruolo (nessun default implicito)', () => {
    for (const role of ALL_ROLES) {
      for (const resource of ALL_RESOURCES) {
        // Non deve mai lanciare per chiave mancante: la matrice e' esaustiva.
        expect(() => can(subject(role), 'read', resource)).not.toThrow()
      }
    }
  })

  it('copre le 27 risorse (26 del blueprint §11.2 + sviluppo D-016)', () => {
    expect(ALL_RESOURCES).toHaveLength(27)
  })
})
