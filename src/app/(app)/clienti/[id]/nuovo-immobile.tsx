'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { Campo } from '@/components/ui'
import { createSite } from '@/lib/actions/sites'

export function NuovoImmobile({ contactId }: { contactId: string }) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { inCorso, esegui } = useAzioneServer()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="bottone-fantasma w-full rounded-lg border border-dashed px-3 py-2 text-xs"
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
        esegui(async () => {
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
          if (esito.ok) {
            avvisa('Immobile aggiunto.')
            setAperto(false)
            router.refresh()
          } else setErrors(esito.errors)
        })
      }}
      className="space-y-3 rounded-md border p-3"
      style={{ borderColor: 'var(--bordo)', background: 'rgba(255,255,255,0.04)' }}
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
        <Campo label="POD" name="pod" errore={errors.pod} placeholder="IT001E12345678" />
      </div>

      {errors._ ? <p className="text-xs text-eco-red-400">{errors._}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-3 py-1.5 text-xs font-semibold text-eco-abisso"
        >
          {inCorso ? 'Salvataggio…' : 'Salva'}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
