'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Bottone, Campo } from '@/components/ui'
import { createOpportunity } from '@/lib/actions/opportunities'

function fraGiorni(giorni: number): string {
  return new Date(Date.now() + giorni * 86_400_000).toISOString().slice(0, 10)
}

export function FormNuovaOpportunita({
  contatti,
  fonti,
  utenti,
  contattoPreselezionato,
  giorniDefault,
}: {
  contatti: readonly { id: string; etichetta: string; telefono: string | null }[]
  fonti: readonly { id: string; label: string }[]
  utenti: readonly { id: string; etichetta: string }[]
  contattoPreselezionato?: string | undefined
  giorniDefault: number
}) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [inCorso, avvia] = useTransition()

  return (
    <form
      action={(formData) => {
        setErrors({})
        avvia(async () => {
          const valore = String(formData.get('estimatedValue') ?? '')
          const scadenza = String(formData.get('nextActionDueAt') ?? '')

          const esito = await createOpportunity({
            contactId: String(formData.get('contactId') ?? ''),
            businessLine: String(formData.get('businessLine') ?? 'fotovoltaico') as
              | 'fotovoltaico'
              | 'elettrico'
              | 'idraulico',
            title: String(formData.get('title') ?? ''),
            estimatedValue: valore ? Number.parseFloat(valore) : undefined,
            sourceId: String(formData.get('sourceId') ?? '') || undefined,
            ownerId: String(formData.get('ownerId') ?? '') || undefined,
            nextActionDueAt: scadenza ? new Date(`${scadenza}T09:00:00`) : undefined,
            nextActionSubject: String(formData.get('nextActionSubject') ?? '') || undefined,
            notes: String(formData.get('notes') ?? '') || undefined,
          })

          if (esito.ok) router.push(`/opportunita/${esito.data.id}`)
          else setErrors(esito.errors)
        })
      }}
      className="space-y-6 rounded-lg border p-6"
      style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
    >
      {errors._ ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errors._}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Cliente<span className="text-red-600"> *</span>
        </span>
        <select
          name="contactId"
          required
          defaultValue={contattoPreselezionato ?? ''}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
        >
          <option value="">Seleziona…</option>
          {contatti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etichetta}
              {c.telefono ? ` — ${c.telefono}` : ''}
            </option>
          ))}
        </select>
        {errors.contactId ? (
          <span className="mt-1 block text-xs text-red-600">{errors.contactId}</span>
        ) : null}
        <span className="mt-1 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Il cliente non c&apos;è?{' '}
          <Link href="/clienti/nuovo" className="text-eco-blue-500 hover:underline">
            Crealo prima
          </Link>
          .
        </span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Linea di business</span>
          <select
            name="businessLine"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
          >
            <option value="fotovoltaico">Fotovoltaico</option>
            <option value="elettrico">Elettrico</option>
            <option value="idraulico">Idraulico</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Fonte</span>
          <select
            name="sourceId"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
          >
            <option value="">Non indicata</option>
            {fonti.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Campo
        label="Descrizione"
        name="title"
        required
        errore={errors.title}
        placeholder="Impianto fotovoltaico 6 kW con accumulo"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Campo
          label="Valore stimato (€)"
          name="estimatedValue"
          type="number"
          errore={errors.estimatedValue}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Responsabile</span>
          <select
            name="ownerId"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
          >
            <option value="">Io</option>
            {utenti.map((u) => (
              <option key={u.id} value={u.id}>
                {u.etichetta}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset
        className="space-y-4 rounded-md border p-4"
        style={{ borderColor: 'var(--bordo)', background: 'var(--sfondo)' }}
      >
        <legend className="px-2 text-sm font-medium">Prima azione</legend>
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Un&apos;opportunità aperta non può esistere senza una prossima azione: viene
          creata insieme all&apos;opportunità.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Cosa fare"
            name="nextActionSubject"
            defaultValue="Primo contatto"
            errore={errors.nextActionSubject}
          />
          <Campo
            label="Entro"
            name="nextActionDueAt"
            type="date"
            defaultValue={fraGiorni(giorniDefault)}
            errore={errors.nextActionDueAt}
          />
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Note</span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
        />
      </label>

      <div className="flex items-center gap-3">
        <Bottone>{inCorso ? 'Creazione…' : 'Crea opportunità'}</Bottone>
        <Link href="/opportunita" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Annulla
        </Link>
      </div>
    </form>
  )
}
