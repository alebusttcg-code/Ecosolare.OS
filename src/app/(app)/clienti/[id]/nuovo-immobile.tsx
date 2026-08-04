'use client'

import { useState, useTransition } from 'react'
import { Campo } from '@/components/ui'
import { createSite } from '@/lib/actions/sites'

export function NuovoImmobile({ contactId }: { contactId: string }) {
  const [aperto, setAperto] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [inCorso, avvia] = useTransition()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="w-full rounded border border-dashed px-3 py-2 text-xs"
        style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
      >
        + Aggiungi immobile
      </button>
    )
  }

  return (
    <form
      action={(formData) => {
        setErrors({})
        avvia(async () => {
          const esito = await createSite({
            contactId,
            label: String(formData.get('label') ?? ''),
            addressLine: String(formData.get('addressLine') ?? ''),
            city: String(formData.get('city') ?? ''),
            province: String(formData.get('province') ?? '') || undefined,
            postalCode: String(formData.get('postalCode') ?? '') || undefined,
            buildingType: String(formData.get('buildingType') ?? '') || undefined,
            pod: String(formData.get('pod') ?? '') || undefined,
          })
          if (esito.ok) setAperto(false)
          else setErrors(esito.errors)
        })
      }}
      className="space-y-3 rounded-md border p-3"
      style={{ borderColor: 'var(--bordo)', background: 'var(--sfondo)' }}
    >
      <Campo label="Nome" name="label" required errore={errors.label} placeholder="Abitazione principale" />
      <Campo label="Indirizzo" name="addressLine" required errore={errors.addressLine} />
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Campo label="Comune" name="city" required errore={errors.city} />
        </div>
        <Campo label="Prov." name="province" errore={errors.province} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Tipo edificio" name="buildingType" errore={errors.buildingType} />
        <Campo label="POD" name="pod" errore={errors.pod} placeholder="IT001E…" />
      </div>

      {errors._ ? <p className="text-xs text-red-600">{errors._}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded bg-eco-blue-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          {inCorso ? 'Salvataggio…' : 'Salva'}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="rounded border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
