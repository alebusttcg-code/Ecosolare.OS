'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { Bottone, Campo } from '@/components/ui'
import { IndirizzoItalia } from '@/components/indirizzo-italia'
import { LINEE_BUSINESS, type LineaBusiness } from '@/lib/domain/linee-business'
import {
  createOpportunity,
  type DuplicatoLead,
  type OpportunityInput,
} from '@/lib/actions/opportunities'

const ETICHETTA_MOTIVO: Record<string, string> = {
  codice_fiscale: 'stesso codice fiscale',
  telefono: 'stesso telefono',
  email: 'stessa email',
  nome_e_comune: 'stesso nome e comune',
}

function fraGiorni(giorni: number): string {
  return new Date(Date.now() + giorni * 86_400_000).toISOString().slice(0, 10)
}

export function FormNuovoLead({
  fonti,
  commerciali,
  giorniDefault,
  contattoEsistente,
}: {
  fonti: readonly { id: string; label: string }[]
  commerciali: readonly { id: string; etichetta: string }[]
  giorniDefault: number
  /** Valorizzato solo quando si apre un lead dalla scheda di un cliente già noto. */
  contattoEsistente?:
    | {
        id: string
        firstName: string | null
        lastName: string
        phone: string | null
        email: string | null
      }
    | undefined
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicati, setDuplicati] = useState<readonly DuplicatoLead[]>([])
  const [bozza, setBozza] = useState<OpportunityInput | null>(null)
  const { inCorso, esegui } = useAzioneServer()
  const [usaEsistente, setUsaEsistente] = useState(Boolean(contattoEsistente))

  function leggiForm(formData: FormData): OpportunityInput {
    const scadenza = String(formData.get('nextActionDueAt') ?? '')
    const canale = String(formData.get('preferredChannel') ?? '')

    return {
      contactId: usaEsistente && contattoEsistente ? contattoEsistente.id : undefined,
      firstName: String(formData.get('firstName') ?? '') || undefined,
      lastName: String(formData.get('lastName') ?? '') || undefined,
      phone: String(formData.get('phone') ?? '') || undefined,
      email: String(formData.get('email') ?? '') || undefined,
      taxCode: String(formData.get('taxCode') ?? '') || undefined,
      streetType: String(formData.get('streetType') ?? '') || undefined,
      streetName: String(formData.get('streetName') ?? '') || undefined,
      houseNumber: String(formData.get('houseNumber') ?? '') || undefined,
      city: String(formData.get('city') ?? '') || undefined,
      province: String(formData.get('province') ?? '') || undefined,
      postalCode: String(formData.get('postalCode') ?? '') || undefined,
      preferredChannel:
        canale === 'telefono' || canale === 'email' || canale === 'whatsapp'
          ? canale
          : undefined,
      marketingConsent: formData.get('marketingConsent') === 'on',
      businessLine: String(
        formData.get('businessLine') ?? 'fotovoltaico',
      ) as LineaBusiness,
      title: String(formData.get('title') ?? ''),
      sourceId: String(formData.get('sourceId') ?? '') || undefined,
      ownerId: String(formData.get('ownerId') ?? ''),
      nextActionDueAt: scadenza ? new Date(`${scadenza}T09:00:00`) : undefined,
      nextActionSubject: String(formData.get('nextActionSubject') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
      confermaNonDuplicato: false,
    }
  }

  function invia(input: OpportunityInput) {
    setBozza(input)
    esegui(async () => {
      const esito = await createOpportunity(input)
      if (esito.ok) {
        avvisa('Lead creato.')
        router.push(`/lead/${esito.data.id}`)
        return
      }
      if ('duplicati' in esito) {
        setDuplicati(esito.duplicati)
        setErrors({})
        return
      }
      setErrors(esito.errors)
      setDuplicati([])
    })
  }

  function riusaContatto(id: string) {
    if (!bozza) return
    invia({ ...bozza, contactId: id, confermaNonDuplicato: false })
  }

  function creaComunque() {
    if (!bozza) return
    invia({ ...bozza, contactId: undefined, confermaNonDuplicato: true })
  }

  return (
    <form
      action={(formData) => invia(leggiForm(formData))}
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

      {duplicati.length > 0 ? (
        <div
          className="space-y-3 rounded-lg border p-4"
          style={{
            borderColor: 'rgba(217,164,65,0.4)',
            background: 'rgba(217,164,65,0.08)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: '#e8c765' }}>
            Potrebbe essere già in anagrafica
          </p>
          <ul className="space-y-2">
            {duplicati.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <Link
                    href={`/clienti/${d.id}`}
                    className="collega text-eco-blue-300 hover:underline"
                  >
                    {d.nome}
                  </Link>
                  <div className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    {d.telefono ?? 'senza telefono'} ·{' '}
                    {d.motivi.map((m) => ETICHETTA_MOTIVO[m] ?? m).join(', ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => riusaContatto(d.id)}
                  className="shrink-0 text-xs text-eco-blue-300 hover:underline"
                >
                  Usa questo
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={creaComunque}
            className="text-xs hover:underline"
            style={{ color: 'var(--testo-tenue)' }}
          >
            Non è nessuno di questi — crea comunque
          </button>
        </div>
      ) : null}

      {contattoEsistente && usaEsistente ? (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.03)' }}
        >
          <p className="font-medium">
            <Link
              href={`/clienti/${contattoEsistente.id}`}
              className="collega text-eco-blue-300 hover:underline"
            >
              {[contattoEsistente.firstName, contattoEsistente.lastName]
                .filter(Boolean)
                .join(' ')}
            </Link>
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
            {[contattoEsistente.phone, contattoEsistente.email].filter(Boolean).join(' · ') ||
              'Nessun recapito'}
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-eco-blue-300 hover:underline"
            onClick={() => setUsaEsistente(false)}
          >
            Inserisci un’altra persona
          </button>
        </div>
      ) : (
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Chi ha chiesto</legend>
          <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
            Nome, cognome e telefono bastano per partire. Il resto si completa quando
            serve.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              label="Nome"
              name="firstName"
              required
              errore={errors.firstName}
              defaultValue={contattoEsistente?.firstName ?? undefined}
            />
            <Campo
              label="Cognome"
              name="lastName"
              required
              errore={errors.lastName}
              defaultValue={contattoEsistente?.lastName}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo
              label="Telefono"
              name="phone"
              required
              errore={errors.phone}
              defaultValue={contattoEsistente?.phone ?? undefined}
            />
            <Campo
              label="Email"
              name="email"
              type="email"
              errore={errors.email}
              defaultValue={contattoEsistente?.email ?? undefined}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Codice fiscale" name="taxCode" errore={errors.taxCode} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Canale di contatto</span>
              <select
                name="preferredChannel"
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

          <IndirizzoItalia errori={errors} />

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="marketingConsent" className="mt-1" />
            <span style={{ color: 'var(--testo-tenue)' }}>
              Ha dato il consenso alle comunicazioni commerciali
            </span>
          </label>
        </fieldset>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">La richiesta</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Linea di business</span>
            <select
              name="businessLine"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            >
              {LINEE_BUSINESS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Fonte</span>
            <select
              name="sourceId"
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
          errore={errors.title}
          placeholder="Impianto fotovoltaico 6 kW con accumulo"
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Responsabile</span>
          <select
            name="ownerId"
            required={commerciali.length > 0}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          >
            <option value="">
              {commerciali.length === 0 ? 'Nessun commerciale abilitato' : 'Seleziona…'}
            </option>
            {commerciali.map((u) => (
              <option key={u.id} value={u.id}>
                {u.etichetta}
              </option>
            ))}
          </select>
          {commerciali.length === 0 ? (
            <span className="mt-1 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
              Crea un utente con ruolo Commerciale in Amministrazione → Utenti.
            </span>
          ) : null}
        </label>
      </fieldset>

      <fieldset
        className="space-y-4 rounded-md border p-4"
        style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
      >
        <legend className="px-2 text-sm font-medium">Prima azione</legend>
        <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Un lead aperto non può esistere senza una prossima azione: viene creata
          insieme al lead.
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
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        />
      </label>

      <div className="flex items-center gap-3">
        <Bottone>{inCorso ? 'Creazione…' : 'Crea lead'}</Bottone>
        <Link href="/lead" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Annulla
        </Link>
      </div>
    </form>
  )
}
