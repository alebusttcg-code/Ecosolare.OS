'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge, formattaData } from '@/components/ui'
import {
  annullaPianificazione,
  avviaInstallazione,
  completaInstallazione,
  pianificaCantiere,
  ripianificaCantiere,
} from '@/lib/actions/schedule'
import {
  etichettaStatoWorkOrder,
  puoAvviareInstallazione,
  puoCompletareInstallazione,
} from '@/lib/domain/schedule'
import type { OperaioInElenco, WorkOrderAttivo } from '@/lib/queries/schedule'
import { useAzioneServer } from '@/lib/use-azione-server'

export function PannelloPianificazione({
  projectId,
  readinessPianificabile,
  plannedStartAt,
  workOrder,
  operai,
  puoScrivere,
}: {
  projectId: string
  readinessPianificabile: boolean
  plannedStartAt: Date | null
  workOrder: WorkOrderAttivo | null
  operai: readonly OperaioInElenco[]
  puoScrivere: boolean
}) {
  if (workOrder) {
    return (
      <RiepilogoPianificazione
        projectId={projectId}
        workOrder={workOrder}
        plannedStartAt={plannedStartAt}
        operai={operai}
        puoScrivere={puoScrivere}
      />
    )
  }

  if (!readinessPianificabile) {
    return (
      <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
        La pianificazione si sblocca quando la commessa è{' '}
        <span style={{ color: 'var(--color-eco-green-400)' }}>Pianificabile</span>.
      </p>
    )
  }

  if (!puoScrivere) {
    return (
      <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
        Commessa pronta: la pianificazione la registra chi ha profilo Operativo.
      </p>
    )
  }

  if (operai.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
        Nessun dipendente attivo da assegnare. L&apos;amministratore li aggiunge in{' '}
        <Link
          href="/amministrazione/impostazioni#personale"
          className="underline hover:text-eco-gold-300"
        >
          Impostazioni → Personale
        </Link>
        .
      </p>
    )
  }

  return (
    <FormPianifica
      projectId={projectId}
      operai={operai}
      defaultDate={
        plannedStartAt
          ? `${plannedStartAt.getUTCFullYear()}-${String(plannedStartAt.getUTCMonth() + 1).padStart(2, '0')}-${String(plannedStartAt.getUTCDate()).padStart(2, '0')}`
          : ''
      }
      modo="crea"
    />
  )
}

function tonoBadge(status: string): 'positivo' | 'attenzione' | 'blu' | 'neutro' {
  if (status === 'in_corso') return 'attenzione'
  if (status === 'completato') return 'blu'
  if (status === 'pianificato') return 'positivo'
  return 'neutro'
}

function RiepilogoPianificazione({
  projectId,
  workOrder,
  plannedStartAt,
  operai,
  puoScrivere,
}: {
  projectId: string
  workOrder: WorkOrderAttivo
  plannedStartAt: Date | null
  operai: readonly OperaioInElenco[]
  puoScrivere: boolean
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [modifica, setModifica] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  const accordoDiverso =
    plannedStartAt !== null && isoUTC(plannedStartAt) !== workOrder.scheduledOnIso

  const puoRipianificare = workOrder.status === 'pianificato'
  const puoAnnullare = workOrder.status === 'pianificato'
  const puoAvviare = puoAvviareInstallazione(workOrder.status)
  const puoCompletare = puoCompletareInstallazione(workOrder.status)

  if (modifica && puoScrivere && puoRipianificare) {
    return (
      <div className="space-y-3">
        <FormPianifica
          projectId={projectId}
          operai={operai}
          defaultDate={workOrder.scheduledOnIso}
          defaultWorkerIds={workOrder.operai.map((o) => o.id)}
          defaultNotes={workOrder.notes ?? ''}
          modo="aggiorna"
          onAnnullato={() => setModifica(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
            Giorno operativo
          </p>
          <p className="mt-0.5 text-base font-semibold">
            {formattaData(workOrder.scheduledOn)}
          </p>
          {accordoDiverso ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-eco-gold-300)' }}>
              Accordo cliente: {formattaData(plannedStartAt)}
            </p>
          ) : null}
        </div>
        <Badge tone={tonoBadge(workOrder.status)}>
          {etichettaStatoWorkOrder(workOrder.status)}
        </Badge>
      </div>

      <div>
        <p className="mb-1.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Operai assegnati
        </p>
        <ul className="flex flex-wrap gap-2">
          {workOrder.operai.map((o) => (
            <li key={o.id}>
              <Badge tone={o.isActive ? 'blu' : 'neutro'}>{o.name}</Badge>
            </li>
          ))}
        </ul>
      </div>

      {workOrder.notes ? (
        <p className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          {workOrder.notes}
        </p>
      ) : null}

      {errore ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </p>
      ) : null}

      {puoScrivere && workOrder.status !== 'completato' ? (
        <div className="flex flex-wrap gap-2">
          {puoAvviare ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => {
                setErrore(null)
                esegui(async () => {
                  const esito = await avviaInstallazione({ projectId })
                  if (!esito.ok) {
                    setErrore(esito.errors._ ?? 'Avvio non riuscito.')
                    return
                  }
                  avvisa('Installazione avviata.')
                  router.refresh()
                })
              }}
              className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
                color: '#050a14',
              }}
            >
              {inCorso ? 'Salvataggio…' : 'Avvia installazione'}
            </button>
          ) : null}

          {puoCompletare ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => {
                setErrore(null)
                esegui(async () => {
                  const esito = await completaInstallazione({ projectId })
                  if (!esito.ok) {
                    setErrore(esito.errors._ ?? 'Chiusura non riuscita.')
                    return
                  }
                  avvisa('Installazione completata.')
                  router.refresh()
                })
              }}
              className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
                color: '#050a14',
              }}
            >
              {inCorso ? 'Salvataggio…' : 'Segna come completata'}
            </button>
          ) : null}

          {puoRipianificare ? (
            <button
              type="button"
              onClick={() => setModifica(true)}
              className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--bordo)' }}
            >
              Ripianifica
            </button>
          ) : null}

          {puoAnnullare ? (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => {
                setErrore(null)
                esegui(async () => {
                  const esito = await annullaPianificazione({ projectId })
                  if (!esito.ok) {
                    setErrore(esito.errors._ ?? 'Annullamento non riuscito.')
                    return
                  }
                  avvisa('Pianificazione annullata.')
                  router.refresh()
                })
              }}
              className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs disabled:opacity-60"
              style={{ borderColor: 'var(--bordo)' }}
            >
              {inCorso ? 'Annullamento…' : 'Annulla pianificazione'}
            </button>
          ) : null}
        </div>
      ) : null}

      {workOrder.status === 'completato' ? (
        <p className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Lavori operativi chiusi. Collaudo e pratiche finali restano sulla scheda.
        </p>
      ) : null}
    </div>
  )
}

function FormPianifica({
  projectId,
  operai,
  defaultDate,
  defaultWorkerIds = [],
  defaultNotes = '',
  modo,
  onAnnullato,
}: {
  projectId: string
  operai: readonly OperaioInElenco[]
  defaultDate: string
  defaultWorkerIds?: readonly string[]
  defaultNotes?: string
  modo: 'crea' | 'aggiorna'
  onAnnullato?: () => void
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [selezionati, setSelezionati] = useState<Set<string>>(
    () => new Set(defaultWorkerIds),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { inCorso, esegui } = useAzioneServer()

  const attivi = operai.filter((o) => o.isActive || selezionati.has(o.id))

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setErrors({})
        const payload = {
          projectId,
          scheduledOn: String(fd.get('scheduledOn') ?? ''),
          workerIds: [...selezionati],
          notes: String(fd.get('notes') ?? '') || undefined,
        }
        esegui(async () => {
          const esito =
            modo === 'crea'
              ? await pianificaCantiere(payload)
              : await ripianificaCantiere(payload)
          if (!esito.ok) {
            setErrors(esito.errors)
            return
          }
          avvisa(modo === 'crea' ? 'Cantiere pianificato.' : 'Pianificazione aggiornata.')
          onAnnullato?.()
          router.refresh()
        })
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          Data cantiere <span style={{ color: 'var(--color-eco-gold-400)' }}>*</span>
        </span>
        <input
          type="date"
          name="scheduledOn"
          required
          defaultValue={defaultDate}
          className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
          style={{
            background: 'rgba(5,10,20,0.6)',
            borderColor: errors.scheduledOn ? 'var(--color-eco-red-400)' : 'var(--bordo)',
          }}
        />
        {errors.scheduledOn ? (
          <span className="mt-1 block text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
            {errors.scheduledOn}
          </span>
        ) : null}
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Operai <span style={{ color: 'var(--color-eco-gold-400)' }}>*</span>
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {attivi.map((o) => {
            const checked = selezionati.has(o.id)
            return (
              <li key={o.id}>
                <label
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                  style={{
                    borderColor: checked ? 'rgba(217,164,65,0.45)' : 'var(--bordo)',
                    background: checked
                      ? 'rgba(217,164,65,0.08)'
                      : 'rgba(5,10,20,0.35)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!o.isActive && !checked}
                    onChange={() => {
                      setSelezionati((prev) => {
                        const next = new Set(prev)
                        if (next.has(o.id)) next.delete(o.id)
                        else next.add(o.id)
                        return next
                      })
                    }}
                    className="rounded"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{o.name}</span>
                    {o.phone ? (
                      <span className="block text-xs" style={{ color: 'var(--testo-fioco)' }}>
                        {o.phone}
                      </span>
                    ) : null}
                    {!o.isActive ? (
                      <span
                        className="block text-xs"
                        style={{ color: 'var(--color-eco-red-400)' }}
                      >
                        disattivato
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {errors.workerIds ? (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
            {errors.workerIds}
          </p>
        ) : null}
        <p className="mt-2 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          Anagrafica in{' '}
          <Link
            href="/amministrazione/impostazioni#personale"
            className="underline hover:text-eco-gold-300"
          >
            Impostazioni → Personale
          </Link>
          .
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Note</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaultNotes}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
          style={{
            background: 'rgba(5,10,20,0.6)',
            borderColor: 'var(--bordo)',
          }}
        />
      </label>

      {errors._ ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errors._}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
            color: '#050a14',
          }}
        >
          {inCorso
            ? 'Salvataggio…'
            : modo === 'crea'
              ? 'Conferma pianificazione'
              : 'Salva modifiche'}
        </button>
        {modo === 'aggiorna' && onAnnullato ? (
          <button
            type="button"
            onClick={onAnnullato}
            className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Chiudi
          </button>
        ) : null}
      </div>
    </form>
  )
}

function isoUTC(data: Date): string {
  const y = data.getUTCFullYear()
  const m = String(data.getUTCMonth() + 1).padStart(2, '0')
  const d = String(data.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
