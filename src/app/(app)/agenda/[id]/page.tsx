import { and, asc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { FotoSopralluogo } from '@/components/carica-foto-sopralluogo'
import { LinkNome, nomePersona } from '@/components/link-nome'
import { Badge, formattaData } from '@/components/ui'
import { getDb } from '@/db'
import { contacts, opportunities, surveyFiles, surveyTemplates, surveys } from '@/db/schema'
import { guard } from '@/lib/auth/session'
import {
  haDatiPrequalificaPerSopralluogo,
  risposteDaPrequalifica,
  unisciRisposteSopralluogo,
} from '@/lib/domain/sopralluogo-prequalifica'
import { correggiDefinizioneQuestionario } from '@/lib/domain/etichette-ui'
import type { DefinizioneQuestionario, Risposte } from '@/lib/domain/questionnaire'
import { CompilaSopralluogo } from './compila'

export const metadata = { title: 'Agenda e sopralluoghi — EcoSolare OS' }

export default async function SopralluogoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await guard('read', 'survey')
  const { id } = await params

  const [riga] = await getDb()
    .select({
      sopralluogo: surveys,
      template: surveyTemplates,
      opportunityId: opportunities.id,
      opportunityCode: opportunities.code,
      opportunityTitle: opportunities.title,
      prequalifica: opportunities.prequalification,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
    })
    .from(surveys)
    .innerJoin(surveyTemplates, eq(surveyTemplates.id, surveys.templateId))
    .innerJoin(opportunities, eq(opportunities.id, surveys.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(and(eq(surveys.id, id), isNull(opportunities.deletedAt)))
    .limit(1)

  if (!riga) notFound()

  const righeFoto = await getDb()
    .select({
      id: surveyFiles.id,
      fieldCode: surveyFiles.fieldCode,
      filename: surveyFiles.filename,
      mimeType: surveyFiles.mimeType,
      sizeBytes: surveyFiles.sizeBytes,
      sortOrder: surveyFiles.sortOrder,
    })
    .from(surveyFiles)
    .where(eq(surveyFiles.surveyId, id))
    .orderBy(asc(surveyFiles.fieldCode), asc(surveyFiles.sortOrder))

  const fotoPerCampo: Record<string, FotoSopralluogo[]> = {}
  for (const f of righeFoto) {
    ;(fotoPerCampo[f.fieldCode] ??= []).push(f)
  }

  const prequalifica = (riga.prequalifica ?? {}) as Risposte
  const risposteIniziali = unisciRisposteSopralluogo(
    risposteDaPrequalifica(prequalifica),
    (riga.sopralluogo.answers ?? {}) as Risposte,
  )
  const daPrequalifica = haDatiPrequalificaPerSopralluogo(prequalifica)

  const completato = riga.sopralluogo.status === 'completato'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/agenda"
          className="text-sm"
          style={{ color: 'var(--testo-tenue)' }}
        >
          ← Agenda e sopralluoghi
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <LinkNome href={`/lead/${riga.opportunityId}`} hero>
              {nomePersona(riga.clienteNome, riga.clienteCognome) || 'Senza nome'}
            </LinkNome>
          </h1>
          <Badge tone={completato ? 'positivo' : 'neutro'}>
            {completato ? 'Completato' : 'In compilazione'}
          </Badge>
          {riga.sopralluogo.hasCriticalIssues ? (
            <Badge tone="attenzione">Criticità</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {riga.template.name} · lead{' '}
          <Link
            href={`/lead/${riga.opportunityId}`}
            className="text-eco-blue-300 hover:underline collega"
          >
            {riga.opportunityCode}
          </Link>
          {completato && riga.sopralluogo.completedAt
            ? ` · chiuso il ${formattaData(riga.sopralluogo.completedAt)}`
            : ''}
        </p>
      </div>

      {completato ? (
        <p
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
        >
          Il sopralluogo è chiuso e non è più modificabile. I dati raccolti alimentano la
          preventivazione.
        </p>
      ) : null}

      <CompilaSopralluogo
        surveyId={riga.sopralluogo.id}
        definizione={correggiDefinizioneQuestionario(
          riga.template.definition as DefinizioneQuestionario,
        )}
        risposteIniziali={risposteIniziali}
        daPrequalifica={daPrequalifica}
        noteIniziali={riga.sopralluogo.notes ?? ''}
        completato={completato}
        fotoPerCampo={fotoPerCampo}
      />
    </div>
  )
}
