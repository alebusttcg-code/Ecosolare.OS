'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import { activities, opportunities, surveyTemplates, surveys } from '@/db/schema'
import { recordEntityChange } from '@/lib/audit'
import { guard } from '@/lib/auth/session'
import {
  calcolaPunteggio,
  criticitaRilevate,
  validaRisposte,
  type DefinizioneQuestionario,
  type Risposte,
} from '@/lib/domain/questionnaire'
import type { ActionResult } from './opportunities'

/**
 * Le risposte arrivano come mappa aperta: la forma la definisce il template,
 * non lo schema. `undefined` e' ammesso perche' un campo svuotato nell'interfaccia
 * arriva cosi', ed e' semanticamente "nessuna risposta" come `null`.
 */
const risposteSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional(),
)

function errori(issues: readonly z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) out[issue.path.join('.') || '_'] ??= issue.message
  return out
}

/* -------------------------------------------------------------------------- */
/*  Prequalifica                                                               */
/* -------------------------------------------------------------------------- */

const prequalificaSchema = z.object({
  opportunityId: z.uuid(),
  templateId: z.uuid(),
  risposte: risposteSchema,
})

/**
 * Salva la prequalifica di un'opportunita' e ne ricalcola il punteggio.
 *
 * La prequalifica **non blocca nulla**: e' uno strumento del commerciale, e un
 * questionario che impedisce di andare avanti al primo contatto e' un
 * questionario che non viene compilato. La validazione produce avvisi, non
 * errori bloccanti.
 */
export async function savePrequalification(
  input: z.input<typeof prequalificaSchema>,
): Promise<
  ActionResult<{
    punteggio: number
    massimo: number
    percentuale: number | null
    campiMancanti: readonly string[]
  }>
> {
  const utente = await guard('update', 'prequalification')

  const parsed = prequalificaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const template = await db.query.surveyTemplates.findFirst({
    where: eq(surveyTemplates.id, dati.templateId),
  })
  if (!template) return { ok: false, errors: { _: 'Questionario non trovato.' } }

  const definizione = template.definition as DefinizioneQuestionario
  const risposte = dati.risposte as Risposte

  const esito = calcolaPunteggio(definizione, risposte)
  const mancanti = validaRisposte(definizione, risposte)
    .filter((v) => v.codice === 'obbligatorio')
    .map((v) => v.label)

  const precedente = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, dati.opportunityId),
    columns: { score: true },
  })

  await db
    .update(opportunities)
    .set({
      prequalification: risposte,
      prequalificationTemplateId: dati.templateId,
      score: esito.punteggio,
      scoreMax: esito.massimo,
      scoreComputedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: utente.id,
    })
    .where(eq(opportunities.id, dati.opportunityId))

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'opportunity',
    entityId: dati.opportunityId,
    before: { score: precedente?.score ?? null },
    after: { score: esito.punteggio },
  })

  revalidatePath(`/lead/${dati.opportunityId}`)
  return {
    ok: true,
    data: {
      punteggio: esito.punteggio,
      massimo: esito.massimo,
      percentuale: esito.percentuale,
      campiMancanti: mancanti,
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Sopralluoghi                                                               */
/* -------------------------------------------------------------------------- */

const creaSopralluogoSchema = z.object({
  opportunityId: z.uuid(),
  siteId: z.uuid().optional(),
  templateId: z.uuid().optional(),
})

export async function createSurvey(
  input: z.input<typeof creaSopralluogoSchema>,
): Promise<ActionResult<{ id: string }>> {
  const utente = await guard('create', 'survey')

  const parsed = creaSopralluogoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()

  // In assenza di indicazione si usa l'ultima versione attiva della checklist
  // della linea di business dell'opportunita'.
  let templateId = dati.templateId
  if (!templateId) {
    const opportunita = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, dati.opportunityId),
      columns: { businessLine: true },
    })
    if (!opportunita) return { ok: false, errors: { _: 'Opportunita non trovata.' } }

    const template = await db.query.surveyTemplates.findFirst({
      where: and(
        eq(surveyTemplates.kind, 'sopralluogo'),
        eq(surveyTemplates.businessLine, opportunita.businessLine),
        eq(surveyTemplates.isActive, true),
      ),
      orderBy: desc(surveyTemplates.version),
      columns: { id: true },
    })
    if (!template) {
      return {
        ok: false,
        errors: {
          _: 'Nessuna checklist di sopralluogo configurata per questa linea di business.',
        },
      }
    }
    templateId = template.id
  }

  const [creato] = await db
    .insert(surveys)
    .values({
      opportunityId: dati.opportunityId,
      siteId: dati.siteId ?? null,
      templateId,
      performedBy: utente.id,
      createdBy: utente.id,
    })
    .returning({ id: surveys.id })

  if (!creato) return { ok: false, errors: { _: 'Creazione non riuscita.' } }

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'create',
    entityType: 'survey',
    entityId: creato.id,
  })

  revalidatePath(`/lead/${dati.opportunityId}`)
  return { ok: true, data: creato }
}

const salvaSopralluogoSchema = z.object({
  surveyId: z.uuid(),
  risposte: risposteSchema,
  notes: z.string().trim().max(4000).optional(),
  /** Se true, tenta la chiusura: e' allora che la validazione diventa bloccante. */
  completa: z.boolean().default(false),
})

export interface EsitoSopralluogo {
  readonly completato: boolean
  readonly violazioni: readonly { campo: string; label: string; messaggio: string }[]
  readonly criticita: readonly string[]
  readonly percentuale: number
}

/**
 * Salva un sopralluogo, e lo chiude se i dati sono completi.
 *
 * Il salvataggio in bozza accetta qualunque stato: si compila sul tetto, con una
 * mano sola, e perdere il lavoro fatto perche' manca un campo sarebbe il modo
 * piu' rapido per far tornare tutti alla carta.
 *
 * **La chiusura invece e' bloccante** (§5.6): un sopralluogo chiuso senza dati
 * obbligatori costringe l'ufficio tecnico a ricontattare il cliente, che e'
 * esattamente il costo che il sistema esiste per eliminare.
 */
export async function saveSurvey(
  input: z.input<typeof salvaSopralluogoSchema>,
): Promise<ActionResult<EsitoSopralluogo>> {
  const utente = await guard('update', 'survey')

  const parsed = salvaSopralluogoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errors: errori(parsed.error.issues) }
  const dati = parsed.data

  const db = getDb()
  const sopralluogo = await db.query.surveys.findFirst({
    where: eq(surveys.id, dati.surveyId),
  })
  if (!sopralluogo) return { ok: false, errors: { _: 'Sopralluogo non trovato.' } }
  if (sopralluogo.status === 'completato') {
    return { ok: false, errors: { _: 'Il sopralluogo e gia stato completato.' } }
  }

  const template = await db.query.surveyTemplates.findFirst({
    where: eq(surveyTemplates.id, sopralluogo.templateId),
  })
  if (!template) return { ok: false, errors: { _: 'Checklist non trovata.' } }

  const definizione = template.definition as DefinizioneQuestionario
  const risposte = dati.risposte as Risposte

  const violazioni = validaRisposte(definizione, risposte)
  const criticita = criticitaRilevate(definizione, risposte)
  const { calcolaCompletezza } = await import('@/lib/domain/questionnaire')
  const completezza = calcolaCompletezza(definizione, risposte)

  const puoCompletare = dati.completa && violazioni.length === 0
  const adesso = new Date()

  // Colonne promosse (ADR-004): i campi usati in elenchi e KPI diventano colonne.
  const potenza = risposte['potenza_stimata']
  const tipoTetto = risposte['tipo_tetto']

  await db.transaction(async (tx) => {
    await tx
      .update(surveys)
      .set({
        answers: risposte,
        notes: dati.notes ?? null,
        estimatedPowerKw:
          typeof potenza === 'number' ? potenza.toFixed(2) : (potenza ? String(potenza) : null),
        roofType: typeof tipoTetto === 'string' ? tipoTetto : null,
        hasCriticalIssues: criticita.length > 0,
        ...(puoCompletare
          ? { status: 'completato' as const, completedAt: adesso, performedAt: sopralluogo.performedAt ?? adesso }
          : {}),
        updatedAt: adesso,
      })
      .where(eq(surveys.id, dati.surveyId))

    // Alla chiusura si crea l'attivita' successiva: il sopralluogo completato
    // deve avviare la preventivazione, non finire in un cassetto (§5.6).
    if (puoCompletare) {
      const opportunita = await tx.query.opportunities.findFirst({
        where: eq(opportunities.id, sopralluogo.opportunityId),
        columns: { id: true, ownerId: true, contactId: true },
      })
      if (opportunita) {
        await tx
          .update(activities)
          .set({ isNextAction: false })
          .where(
            and(
              eq(activities.opportunityId, opportunita.id),
              eq(activities.isNextAction, true),
            ),
          )

        const scadenza = new Date(adesso.getTime() + 2 * 86_400_000)
        await tx.insert(activities).values({
          kind: 'task',
          subject: 'Preparare il preventivo',
          notes:
            criticita.length > 0
              ? `Criticita rilevate in sopralluogo: ${criticita.map((c) => c.label).join(', ')}.`
              : null,
          opportunityId: opportunita.id,
          contactId: opportunita.contactId,
          assignedTo: opportunita.ownerId,
          dueAt: scadenza,
          isNextAction: true,
          createdBy: utente.id,
        })

        await tx
          .update(opportunities)
          .set({ nextActionDueAt: scadenza, updatedAt: adesso, updatedBy: utente.id })
          .where(eq(opportunities.id, opportunita.id))
      }
    }
  })

  await recordEntityChange({
    actorId: utente.id,
    actorLabel: utente.email,
    action: 'update',
    entityType: 'survey',
    entityId: dati.surveyId,
    before: { status: sopralluogo.status },
    after: { status: puoCompletare ? 'completato' : sopralluogo.status },
  })

  revalidatePath(`/agenda/${dati.surveyId}`)
  revalidatePath(`/lead/${sopralluogo.opportunityId}`)

  return {
    ok: true,
    data: {
      completato: puoCompletare,
      violazioni: violazioni.map((v) => ({
        campo: v.campo,
        label: v.label,
        messaggio: v.messaggio,
      })),
      criticita: criticita.map((c) => c.label),
      percentuale: completezza.percentuale,
    },
  }
}
