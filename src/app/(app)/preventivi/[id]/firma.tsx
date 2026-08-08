'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { signContractAndOpenProject } from '@/lib/actions/projects'

/**
 * Registrazione della firma.
 *
 * È il passaggio che apre la commessa con dentro tutto già impostato: task,
 * checklist documentale, distinta materiali, pratiche e piano pagamenti. Per
 * questo il modulo dice cosa succederà: l'operazione non è annullabile con un
 * clic e vale la pena saperlo prima.
 */
export function RegistraFirma({ versionId }: { versionId: string }) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  const oggi = new Date().toISOString().slice(0, 10)

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="bottone-oro w-full rounded-lg px-4 py-2 text-sm font-semibold"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        Registra la firma
      </button>
    )
  }

  return (
    <form
      action={(fd) => {
        setErrore(null)
        esegui(async () => {
          const data = String(fd.get('signedAt') ?? '')
          const esito = await signContractAndOpenProject({
            quoteVersionId: versionId,
            signedAt: new Date(`${data}T12:00:00`),
            signatureMethod: String(fd.get('method') ?? 'cartacea') as 'cartacea',
          })
          if (esito.ok) {
            avvisa('Firma registrata: cantiere aperto.')
            router.push(`/cantieri/${esito.data.projectId}`)
          } else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        })
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-medium">Data della firma</span>
        <input
          name="signedAt"
          type="date"
          required
          defaultValue={oggi}
          className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-eco-blue-400"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium">Modalità</span>
        <select
          name="method"
          className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-eco-blue-400"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        >
          <option value="cartacea">Cartacea</option>
          <option value="scansione">Scansione via email</option>
          <option value="elettronica">Firma elettronica</option>
        </select>
      </label>

      <p
        className="rounded-lg border p-3 text-xs leading-relaxed"
        style={{
          borderColor: 'rgba(217,164,65,0.35)',
          background: 'rgba(217,164,65,0.06)',
          color: '#e8c765',
        }}
      >
        Verrà aperta la commessa in «Cantieri e commesse» con task, checklist
        documentale, distinta materiali, pratiche e piano pagamenti. Il lead
        passerà a <strong>contratto firmato</strong>.
      </p>

      {errore ? <p className="text-xs text-eco-red-400">{errore}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="bottone-oro flex-1 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
            color: '#050a14',
          }}
        >
          {inCorso ? 'Apertura…' : 'Conferma e apri'}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="bottone-fantasma rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
