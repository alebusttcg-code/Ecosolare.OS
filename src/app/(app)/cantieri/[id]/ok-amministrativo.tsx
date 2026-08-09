'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { ScegliFile } from '@/components/scegli-file'
import {
  caricaContabile,
  concediOkAmministrativo,
  revocaOkAmministrativo,
} from '@/lib/actions/banca'
import { normalizzaAllegato } from '@/lib/domain/normalizza-allegato'
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
  const avvisa = useAvvisi()
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  function carica(file: File) {
    setErrore(null)
    esegui(async () => {
      let allegato: File
      try {
        allegato = await normalizzaAllegato(file)
      } catch (errore) {
        setErrore(
          errore instanceof Error
            ? errore.message
            : 'Non è stato possibile preparare il file per il caricamento.',
        )
        return
      }
      const dati = new FormData()
      dati.set('milestoneId', milestoneId)
      dati.set('file', allegato)
      try {
        const esito = await caricaContabile(dati)
        if (esito.ok) {
          avvisa('Contabile caricata.')
          router.refresh()
        } else {
          setErrore(Object.values(esito.errors)[0] ?? 'Caricamento non riuscito.')
        }
      } catch (errore) {
        setErrore(
          errore instanceof Error ? errore.message : 'Caricamento non riuscito.',
        )
      }
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
            esegui(async () => {
              await revocaOkAmministrativo(milestoneId)
              avvisa('Via libera revocato.', 'info')
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
        <ScegliFile
          onFile={carica}
          disabled={inCorso}
          etichetta={contabili.length > 0 ? '+ Altra contabile' : '+ Contabile'}
        />

        <button
          type="button"
          disabled={inCorso || contabili.length === 0}
          title={
            contabili.length === 0
              ? 'Carica prima la contabile ricevuta dal cliente'
              : undefined
          }
          onClick={() =>
            esegui(async () => {
              setErrore(null)
              const esito = await concediOkAmministrativo({ milestoneId })
              if (esito.ok) {
                avvisa('Via libera amministrativo concesso.')
                router.refresh()
              } else setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
            })
          }
          className="bottone-oro rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
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
