'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Bottone, Campo } from '@/components/ui'
import {
  createContact,
  type ContactInput,
  type DuplicatoSegnalato,
} from '@/lib/actions/contacts'

const ETICHETTA_MOTIVO: Record<string, string> = {
  codice_fiscale: 'stesso codice fiscale',
  telefono: 'stesso telefono',
  email: 'stessa email',
  nome_e_comune: 'stesso nome e comune',
}

export function FormNuovoCliente() {
  const router = useRouter()
  const [inCorso, avvia] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicati, setDuplicati] = useState<readonly DuplicatoSegnalato[]>([])
  const [dati, setDati] = useState<ContactInput | null>(null)

  function invia(formData: FormData, confermaNonDuplicato: boolean) {
    const input: ContactInput = {
      firstName: String(formData.get('firstName') ?? '') || undefined,
      lastName: String(formData.get('lastName') ?? ''),
      email: String(formData.get('email') ?? '') || undefined,
      phone: String(formData.get('phone') ?? '') || undefined,
      taxCode: String(formData.get('taxCode') ?? '') || undefined,
      city: String(formData.get('city') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
      marketingConsent: formData.get('marketingConsent') === 'on',
      confermaNonDuplicato,
    }
    setDati(input)

    avvia(async () => {
      const esito = await createContact(input)
      if (esito.ok) {
        router.push(`/clienti/${esito.id}`)
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

  function confermaCreazione() {
    if (!dati) return
    avvia(async () => {
      const esito = await createContact({ ...dati, confermaNonDuplicato: true })
      if (esito.ok) router.push(`/clienti/${esito.id}`)
      else if (!('duplicati' in esito)) setErrors(esito.errors)
    })
  }

  return (
    <form
      action={(formData) => invia(formData, false)}
      className="space-y-6 rounded-lg border p-6"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      {errors._ ? (
        <p className="rounded-lg border p-3 text-sm" style={{ borderColor: 'rgba(224,133,133,0.42)', background: 'rgba(224,133,133,0.08)', color: '#f0c9c9' }}>
          {errors._}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Nome" name="firstName" errore={errors.firstName} />
        <Campo label="Cognome" name="lastName" required errore={errors.lastName} />
        <Campo label="Telefono" name="phone" errore={errors.phone} placeholder="333 1234567" />
        <Campo label="Email" name="email" type="email" errore={errors.email} />
        <Campo label="Codice fiscale" name="taxCode" errore={errors.taxCode} />
        <Campo label="Comune" name="city" errore={errors.city} />
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Note</span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="marketingConsent" className="mt-0.5" />
        <span>
          Ha prestato consenso a ricevere comunicazioni commerciali.
          <span className="mt-0.5 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
            Senza consenso registrato, le automazioni non useranno email e WhatsApp per
            questo contatto.
          </span>
        </span>
      </label>

      {duplicati.length > 0 ? (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: 'rgba(217,164,65,0.42)', background: 'rgba(217,164,65,0.08)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: '#e8c765' }}>
            Possibile duplicato
          </h3>
          <p className="mt-1 text-xs" style={{ color: '#e8c765' }}>
            Esistono contatti simili. Aprine uno per aggiungere lì la nuova richiesta,
            oppure conferma che si tratta di una persona diversa.
          </p>
          <ul className="mt-3 space-y-2">
            {duplicati.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 text-sm">
                <Link
                  href={`/clienti/${d.id}`}
                  className="font-medium text-eco-blue-300 hover:underline"
                >
                  {d.nome}
                </Link>
                <span className="text-xs" style={{ color: '#e8c765' }}>
                  {d.motivi.map((m) => ETICHETTA_MOTIVO[m] ?? m).join(', ')} · {d.score}/100
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <button
              type="button"
              onClick={confermaCreazione}
              disabled={inCorso}
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ borderColor: '#e8b924', color: '#e8c765' }}
            >
              È una persona diversa, crea comunque
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Bottone>{inCorso ? 'Salvataggio…' : 'Crea cliente'}</Bottone>
        <Link href="/clienti" className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
          Annulla
        </Link>
      </div>
    </form>
  )
}
