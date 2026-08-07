'use server'

import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  contacts,
  opportunities,
  pipelineStages,
  projectStages,
  projects,
} from '@/db/schema'
import { can } from '@/lib/auth/policy'
import { getCurrentUser } from '@/lib/auth/session'
import { normalizePhone } from '@/lib/domain/phone'

export interface RisultatoRicerca {
  readonly tipo: 'anagrafica' | 'lead' | 'cantiere'
  readonly id: string
  readonly titolo: string
  readonly dettaglio: string
  readonly href: string
}

const schema = z.string().trim().min(2).max(80)

/**
 * Ricerca globale (⌘K) su anagrafica, lead e cantieri.
 *
 * Attraversa più risorse, quindi non c'è un solo `guard`: ogni blocco entra
 * nei risultati solo se `can(utente, 'read', risorsa)` — stesso policy layer,
 * usato come filtro invece che come sbarramento (ADR-006). Chi non può
 * leggere una risorsa semplicemente non la vede tra i risultati.
 */
export async function cercaGlobale(termine: string): Promise<RisultatoRicerca[]> {
  const utente = await getCurrentUser()
  if (!utente) return []

  const parsed = schema.safeParse(termine)
  if (!parsed.success) return []
  const q = parsed.data
  const testo = `%${q}%`
  const comeTelefono = normalizePhone(q).e164
  const db = getDb()

  const [anagrafica, lead, cantieri] = await Promise.all([
    can(utente, 'read', 'contact')
      ? db
          .select({
            id: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            phone: contacts.phone,
            email: contacts.email,
          })
          .from(contacts)
          .where(
            and(
              isNull(contacts.deletedAt),
              or(
                ilike(contacts.lastName, testo),
                ilike(contacts.firstName, testo),
                ilike(contacts.emailNormalized, `%${q.toLowerCase()}%`),
                ilike(contacts.phone, testo),
                ...(comeTelefono ? [eq(contacts.phoneE164, comeTelefono)] : []),
              ),
            ),
          )
          .orderBy(desc(contacts.createdAt))
          .limit(5)
      : Promise.resolve([]),

    can(utente, 'read', 'opportunity')
      ? db
          .select({
            id: opportunities.id,
            code: opportunities.code,
            title: opportunities.title,
            stageLabel: pipelineStages.label,
            aperto: pipelineStages.isOpen,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
          })
          .from(opportunities)
          .innerJoin(pipelineStages, eq(pipelineStages.code, opportunities.stage))
          .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
          .where(
            and(
              isNull(opportunities.deletedAt),
              isNull(contacts.deletedAt),
              or(
                ilike(opportunities.title, testo),
                ilike(opportunities.code, testo),
                ilike(contacts.lastName, testo),
                ilike(contacts.firstName, testo),
                ilike(contacts.phone, testo),
                ...(comeTelefono ? [eq(contacts.phoneE164, comeTelefono)] : []),
              ),
            ),
          )
          .orderBy(
            // Prima i lead ancora aperti: sono quelli su cui si lavora.
            sql`${pipelineStages.isOpen} desc`,
            desc(opportunities.createdAt),
          )
          .limit(6)
      : Promise.resolve([]),

    can(utente, 'read', 'project')
      ? db
          .select({
            id: projects.id,
            code: projects.code,
            title: projects.title,
            stageLabel: projectStages.label,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
          })
          .from(projects)
          .innerJoin(projectStages, eq(projectStages.code, projects.stage))
          .innerJoin(contacts, eq(contacts.id, projects.contactId))
          .where(
            and(
              isNull(projects.deletedAt),
              or(
                ilike(projects.title, testo),
                ilike(projects.code, testo),
                ilike(contacts.lastName, testo),
                ilike(contacts.firstName, testo),
              ),
            ),
          )
          .orderBy(desc(projects.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ])

  const nome = (f: string | null, l: string) => [f, l].filter(Boolean).join(' ')

  return [
    ...anagrafica.map((c) => ({
      tipo: 'anagrafica' as const,
      id: c.id,
      titolo: nome(c.firstName, c.lastName),
      dettaglio: [c.phone, c.email].filter(Boolean).join(' · ') || 'Nessun recapito',
      href: `/clienti/${c.id}`,
    })),
    ...lead.map((l) => ({
      tipo: 'lead' as const,
      id: l.id,
      titolo: l.title,
      dettaglio: `${l.code} · ${nome(l.firstName, l.lastName)} · ${l.stageLabel}`,
      href: `/lead/${l.id}`,
    })),
    ...cantieri.map((p) => ({
      tipo: 'cantiere' as const,
      id: p.id,
      titolo: p.title,
      dettaglio: `${p.code} · ${nome(p.firstName, p.lastName)} · ${p.stageLabel}`,
      href: `/cantieri/${p.id}`,
    })),
  ]
}
