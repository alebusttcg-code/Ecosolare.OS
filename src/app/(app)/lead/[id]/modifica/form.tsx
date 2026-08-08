'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { Bottone, Campo } from '@/components/ui'
import { IndirizzoItalia, type IndirizzoIniziale } from '@/components/indirizzo-italia'
import { updateLead } from '@/lib/actions/opportunities'

export function FormModificaLead({
  opportunityId,
  fonti,
  commerciali,
  iniziale,
}: {
  opportunityId: string
  fonti: readonly { id: string; label: string }[]
  commerciali: readonly { id: string; etichetta: string }[]
  iniziale: {
    firstName: string
    lastName: string
    phone: string
    email: string
    taxCode: string
    preferredChannel: '' | 'telefono' | 'email' | 'whatsapp'
    marketingConsent: boolean
    businessLine: 'fotovoltaico' | 'elettrico' | 'idraulico'
    title: string
    sourceId: string
    ownerId: string
    notes: string
    indirizzo: IndirizzoIniziale
  }
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { inCorso, esegui } = useAzioneServer()

  return (
    <form
      action={(formData) => {
        setErrors({})
        const canale = String(formData.get('preferredChannel') ?? '')
        esegui(async () => {
          const esito = await updateLead({
            opportunityId,
            firstName: String(formData.get('firstName') ?? ''),
            lastName: String(formData.get('lastName') ?? ''),
            phone: String(formData.get('phone') ?? ''),
            email: String(formData.get('email') ?? '') || undefined,
            taxCode: String(formData.get('taxCode') ?? '') || undefined,
            preferredChannel:
              canale === 'telefono' || canale === 'email' || canale === 'whatsapp'
                ? canale
                : undefined,
            marketingConsent: formData.get('marketingConsent') === 'on',
            streetType: String(formData.get('streetType') ?? '') || undefined,
            streetName: String(formData.get('streetName') ?? '') || undefined,
            houseNumber: String(formData.get('houseNumber') ?? '') || undefined,
            city: String(formData.get('city') ?? '') || undefined,
            province: String(formData.get('province') ?? '') || undefined,
            postalCode: String(formData.get('postalCode') ?? '') || undefined,
            businessLine: String(formData.get('businessLine') ?? 'fotovoltaico') as
              | 'fotovoltaico'
              | 'elettrico'
              | 'idraulico',
            title: String(formData.get('title') ?? ''),
            sourceId: String(formData.get('sourceId') ?? '') || undefined,
            ownerId: String(formData.get('ownerId') ?? ''),
            notes: String(formData.get('notes') ?? '') || undefined,
          })

          if (!esito.ok) {
            setErrors(esito.errors)
            return
          }
          avvisa('Lead aggiornato.')
          router.push(`/lead/${opportunityId}`)
          router.refresh()
        })
      }}
      className="space-y-6 rounded-lg border p-6"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      {errors._ ? (
        <p
          className="rounded-lg border p-3 text-sm"
          style={{
            borderColor: 'rgba(224,133,133,0.42)',
            background: 'rgba(224,133,133,0.08)',
            color: '#f0c9c9',
          }}
        >
          {errors._}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Chi ha chiesto</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Nome"
            name="firstName"
            required
            defaultValue={iniziale.firstName}
            errore={errors.firstName}
          />
          <Campo
            label="Cognome"
            name="lastName"
            required
            defaultValue={iniziale.lastName}
            errore={errors.lastName}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Telefono"
            name="phone"
            required
            defaultValue={iniziale.phone}
            errore={errors.phone}
          />
          <Campo
            label="Email"
            name="email"
            type="email"
            defaultValue={iniziale.email}
            errore={errors.email}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Codice fiscale"
            name="taxCode"
            defaultValue={iniziale.taxCode}
            errore={errors.taxCode}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Canale di contatto</span>
            <select
              name="preferredChannel"
              defaultValue={iniziale.preferredChannel}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            >
              <option value="">Non indicato</option>
              <option value="telefono">Telefono</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>
        </div>
        <IndirizzoItalia errori={errors} iniziale={iniziale.indirizzo} />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="marketingConsent"
            className="mt-1"
            defaultChecked={iniziale.marketingConsent}
          />
          <span style={{ color: 'var(--testo-tenue)' }}>
            Ha dato il consenso alle comunicazioni commerciali
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">La richiesta</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Linea di business</span>
            <select
              name="businessLine"
              defaultValue={iniziale.businessLine}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
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
              defaultValue={iniziale.sourceId}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
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
          defaultValue={iniziale.title}
          errore={errors.title}
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Responsabile</span>
          <select
            name="ownerId"
            required
            defaultValue={iniziale.ownerId}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
            style={{
              background: 'rgba(5,10,20,0.55)',
              borderColor: errors.ownerId ? 'var(--color-eco-red-400)' : 'var(--bordo)',
            }}
          >
            <option value="">Seleziona…</option>
            {commerciali.map((u) => (
              <option key={u.id} value={u.id}>
                {u.etichetta}
              </option>
            ))}
          </select>
          {errors.ownerId ? (
            <span className="mt-1 block text-xs text-eco-red-400">{errors.ownerId}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Note</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={iniziale.notes}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <Bottone>{inCorso ? 'Salvataggio…' : 'Salva modifiche'}</Bottone>
        <Link
          href={`/lead/${opportunityId}`}
          className="text-sm"
          style={{ color: 'var(--testo-tenue)' }}
        >
          Annulla
        </Link>
      </div>
    </form>
  )
}
