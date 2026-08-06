'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import {
  caricaContabile,
  concediOkAmministrativo,
  revocaOkAmministrativo,
} from '@/lib/actions/banca'
import { formattaDimensione } from '@/lib/domain/upload'

export interface ContabileCaricata {
  readonly id: string
  readonly filename: string
  readonly sizeBytes: number
}

/**
 * Via libera amministrativo su una scadenza di pagamento.
 *
 * Due passaggi separati di proposito: prima si carica la contabile ricevuta dal
 * cliente, poi si concede l'OK. Non è burocrazia — l'OK sblocca il cantiere, e
 * quando l'estratto conto non confermerà l'incasso la prima domanda sarà «cosa
 * ci aveva mandato il cliente».
 */
export function OkAmministrativo({
  milestoneId,
  concessoIl,
  concessoDa,
  contabili,
}: {
  milestoneId: string
  concessoIl: Date | null
  concessoDa: string | null
  contabili: readonly ContabileCaricata[]
}) {
  const router = useRouter()
  const campo = useRef<HTMLInputElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  function carica(file: File) {
    setErrore(null)
    const dati = new FormData()
    dati.set('milestoneId', milestoneId)
    dati.set('file', file)
    avvia(async () => {
      const esito = await caricaContabile(dati)
      if (esito.ok) {
        if (campo.current) campo.current.value = ''
        router.refresh()
      } else setErrore(Object.values(esito.errors)[0] ?? 'Caricamento non riuscito.')
    })
  }

  if (concessoIl) {
    return (
      <div className="mt-2 text-xs">
        <span style={{ color: 'var(--color-eco-green-400)' }}>
          ✓ Via libera concesso
          {concessoDa ? ` da ${concessoDa}` : ''} il{' '}
          {new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(concessoIl)}
        </span>
        <button
          type="button"
          disabled={inCorso}
          onClick={() =>
            avvia(async () => {
              await revocaOkAmministrativo(milestoneId)
              router.refresh()
            })
          }
          className="ml-3 underline"
          style={{ color: 'var(--testo-fioco)' }}
        >
          revoca
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {contabili.length > 0 ? (
        <ul className="space-y-1">
          {contabili.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-xs">
              <span aria-hidden style={{ color: 'var(--color-eco-blue-300)' }}>
                ▤
              </span>
              <a
                href={`/api/documenti/${c.id}`}
                target="_blank"
                rel="noreferrer"
                className="collega truncate"
                style={{ color: 'var(--color-eco-blue-300)' }}
              >
                {c.filename}
              </a>
              <span style={{ color: 'var(--testo-fioco)' }}>
                {formattaDimensione(c.sizeBytes)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label
          className="bottone-fantasma cursor-pointer rounded-lg border px-2.5 py-1 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          <input
            ref={campo}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            disabled={inCorso}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) carica(file)
            }}
          />
          {contabili.length > 0 ? '+ Altra contabile' : '+ Contabile'}
        </label>

        <button
          type="button"
          disabled={inCorso || contabili.length === 0}
          title={
            contabili.length === 0
              ? 'Carica prima la contabile ricevuta dal cliente'
              : undefined
          }
          onClick={() =>
            avvia(async () => {
              setErrore(null)
              const esito = await concediOkAmministrativo({ milestoneId })
              if (esito.ok) router.refresh()
              else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
            })
          }
          className="bottone-oro rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
            color: '#050a14',
          }}
        >
          Dai il via libera
        </button>
      </div>

      {errore ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </p>
      ) : null}
    </div>
  )
}
