'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  setDocumentStatus,
  setMaterialStatus,
  setPaymentStatus,
  setPracticeStatus,
  setProjectConfirmation,
  toggleProjectTask,
} from '@/lib/actions/project-items'
import { useAzioneServer } from '@/lib/use-azione-server'

/** Piccolo selettore che salva subito e ricalcola la pianificabilità. */
function Selettore({
  valore,
  opzioni,
  onCambia,
  larghezza = 'w-44',
}: {
  valore: string
  opzioni: readonly { value: string; label: string }[]
  onCambia: (nuovo: string) => void
  larghezza?: string
}) {
  return (
    <select
      value={valore}
      onChange={(e) => onCambia(e.target.value)}
      className={`${larghezza} rounded-md border px-2 py-1.5 text-xs transition-colors duration-200 outline-none focus:border-eco-blue-400`}
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      {opzioni.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

const STATI_DOCUMENTO = [
  { value: 'richiesto', label: 'Richiesto' },
  { value: 'caricato', label: 'Caricato' },
  { value: 'da_verificare', label: 'Da verificare' },
  { value: 'approvato', label: 'Approvato' },
  { value: 'respinto', label: 'Respinto' },
  { value: 'scaduto', label: 'Scaduto' },
  { value: 'non_necessario', label: 'Non necessario' },
] as const

export function ControlloDocumento({
  requirementId,
  stato,
}: {
  requirementId: string
  stato: string
}) {
  const router = useRouter()
  const [errore, setErrore] = useState<string | null>(null)
  const [chiedeMotivo, setChiedeMotivo] = useState(false)
  const { esegui } = useAzioneServer()

  function cambia(nuovo: string, motivo?: string) {
    setErrore(null)
    // Respingere richiede un motivo: si chiede prima, non dopo aver salvato.
    if (nuovo === 'respinto' && !motivo) {
      setChiedeMotivo(true)
      return
    }
    esegui(async () => {
      const esito = await setDocumentStatus({
        requirementId,
        status: nuovo as 'approvato',
        ...(motivo ? { rejectionReason: motivo } : {}),
      })
      if (esito.ok) {
        setChiedeMotivo(false)
        router.refresh()
      } else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
    })
  }

  return (
    <div className="text-right">
      <Selettore valore={stato} opzioni={STATI_DOCUMENTO} onCambia={cambia} />
      {chiedeMotivo ? (
        <form
          action={(fd) => cambia('respinto', String(fd.get('motivo') ?? ''))}
          className="mt-2 flex gap-2"
        >
          <input
            name="motivo"
            required
            placeholder="Motivo del rifiuto"
            className="w-48 max-w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-eco-blue-400"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
          <button
            type="submit"
            className="bottone-fantasma rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Salva
          </button>
        </form>
      ) : null}
      {errore ? <p className="mt-1 text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}

const STATI_MATERIALE = [
  { value: 'da_ordinare', label: 'Da ordinare' },
  { value: 'ordinato', label: 'Ordinato' },
  { value: 'parzialmente_consegnato', label: 'Consegna parziale' },
  { value: 'consegnato', label: 'Consegnato' },
  { value: 'non_disponibile', label: 'Non disponibile' },
] as const

export function ControlloMateriale({
  materialId,
  stato,
  critico,
}: {
  materialId: string
  stato: string
  critico: boolean
}) {
  const router = useRouter()
  const { esegui } = useAzioneServer()

  const salva = (patch: { status?: string; critical?: boolean }) =>
    esegui(async () => {
      await setMaterialStatus({
        materialId,
        status: (patch.status ?? stato) as 'ordinato',
        ...(patch.critical !== undefined ? { critical: patch.critical } : {}),
      })
      router.refresh()
    })

  return (
    <div className="flex items-center justify-end gap-3">
      <label
        className="flex cursor-pointer items-center gap-1.5 text-xs"
        style={{ color: critico ? 'var(--color-eco-gold-300)' : 'var(--testo-fioco)' }}
        title="Un materiale critico impedisce la partenza del cantiere finché non è consegnato"
      >
        <input
          type="checkbox"
          checked={critico}
          onChange={(e) => salva({ critical: e.target.checked })}
        />
        critico
      </label>
      <Selettore
        valore={stato}
        opzioni={STATI_MATERIALE}
        onCambia={(nuovo) => salva({ status: nuovo })}
        larghezza="w-40"
      />
    </div>
  )
}

const STATI_PRATICA = [
  { value: 'da_preparare', label: 'Da preparare' },
  { value: 'in_preparazione', label: 'In preparazione' },
  { value: 'inviata', label: 'Inviata' },
  { value: 'approvata', label: 'Approvata' },
  { value: 'respinta', label: 'Respinta' },
] as const

export function ControlloPratica({
  practiceId,
  stato,
}: {
  practiceId: string
  stato: string
}) {
  const router = useRouter()
  const { esegui } = useAzioneServer()

  return (
    <Selettore
      valore={stato}
      opzioni={STATI_PRATICA}
      larghezza="w-40"
      onCambia={(nuovo) =>
        esegui(async () => {
          await setPracticeStatus({ practiceId, status: nuovo as 'inviata' })
          router.refresh()
        })
      }
    />
  )
}

const STATI_PAGAMENTO = [
  { value: 'previsto', label: 'Previsto' },
  { value: 'fatturato', label: 'Fatturato' },
  { value: 'incassato', label: 'Incassato' },
  { value: 'insoluto', label: 'Insoluto' },
] as const

export function ControlloPagamento({
  milestoneId,
  stato,
}: {
  milestoneId: string
  stato: string
}) {
  const router = useRouter()
  const { esegui } = useAzioneServer()

  return (
    <Selettore
      valore={stato}
      opzioni={STATI_PAGAMENTO}
      larghezza="w-32"
      onCambia={(nuovo) =>
        esegui(async () => {
          await setPaymentStatus({ milestoneId, status: nuovo as 'incassato' })
          router.refresh()
        })
      }
    />
  )
}

export function ControlloTask({
  taskId,
  completato,
  etichetta,
}: {
  taskId: string
  completato: boolean
  etichetta: string
}) {
  const router = useRouter()
  const { esegui } = useAzioneServer()

  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={completato}
        onChange={() =>
          esegui(async () => {
            await toggleProjectTask(taskId)
            router.refresh()
          })
        }
      />
      <span
        style={{
          color: completato ? 'var(--testo-fioco)' : 'var(--testo)',
          textDecoration: completato ? 'line-through' : 'none',
        }}
      >
        {etichetta}
      </span>
    </label>
  )
}

export function ControlloConferma({
  projectId,
  campo,
  attivo,
  etichetta,
}: {
  projectId: string
  campo: 'verifica_tecnica' | 'conferma_cliente'
  attivo: boolean
  etichetta: string
}) {
  const router = useRouter()
  const { esegui } = useAzioneServer()

  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={attivo}
        onChange={(e) =>
          esegui(async () => {
            await setProjectConfirmation({ projectId, campo, valore: e.target.checked })
            router.refresh()
          })
        }
      />
      <span style={{ color: attivo ? 'var(--color-eco-green-400)' : 'var(--testo)' }}>
        {etichetta}
      </span>
    </label>
  )
}
