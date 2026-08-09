'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { useAzioneServer } from '@/lib/use-azione-server'
import { ScegliFile } from '@/components/scegli-file'
import {
  caricaContabile,
  concediOkAmministrativo,
  deleteContabile,
  revocaOkAmministrativo,
} from '@/lib/actions/banca'
import { normalizzaAllegato } from '@/lib/domain/normalizza-allegato'
import {
  DIMENSIONE_MASSIMA_UPLOAD,
  formattaDimensione,
} from '@/lib/domain/upload'

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
  /** Anteprima immediata dopo l’upload, finché il refresh non riporta i dati server. */
  const [appenaCaricate, setAppenaCaricate] = useState<ContabileCaricata[]>([])
  const { inCorso, esegui } = useAzioneServer()

  const elencate = useMemo(() => {
    const visti = new Set(contabili.map((c) => c.id))
    return [...contabili, ...appenaCaricate.filter((c) => !visti.has(c.id))]
  }, [contabili, appenaCaricate])

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

      if (allegato.size > DIMENSIONE_MASSIMA_UPLOAD) {
        setErrore(
          `Il file pesa ${formattaDimensione(allegato.size)}: il limite di caricamento è ${formattaDimensione(DIMENSIONE_MASSIMA_UPLOAD)}.`,
        )
        return
      }

      const dati = new FormData()
      dati.set('milestoneId', milestoneId)
      dati.set('file', allegato)
      try {
        const esito = await caricaContabile(dati)
        if (esito.ok) {
          setAppenaCaricate((precedenti) => [...precedenti, esito.data])
          avvisa('Contabile caricata.')
          router.refresh()
        } else {
          setErrore(Object.values(esito.errors)[0] ?? 'Caricamento non riuscito.')
        }
      } catch (errore) {
        const messaggio =
          errore instanceof Error ? errore.message : 'Caricamento non riuscito.'
        setErrore(
          /accesso non consentito/i.test(messaggio)
            ? 'Non hai il permesso di caricare contabili (serve amministrazione o contabilità).'
            : /body exceeded|413|too large/i.test(messaggio)
              ? `Il file è troppo grande per il caricamento (limite ${formattaDimensione(DIMENSIONE_MASSIMA_UPLOAD)}).`
              : messaggio,
        )
      }
    })
  }

  function elimina(id: string) {
    setErrore(null)
    esegui(async () => {
      try {
        const esito = await deleteContabile(id)
        if (esito.ok) {
          setAppenaCaricate((precedenti) => precedenti.filter((c) => c.id !== id))
          avvisa('Contabile eliminata.', 'info')
          router.refresh()
        } else {
          setErrore(Object.values(esito.errors)[0] ?? 'Eliminazione non riuscita.')
        }
      } catch (errore) {
        const messaggio =
          errore instanceof Error ? errore.message : 'Eliminazione non riuscita.'
        setErrore(
          /accesso non consentito/i.test(messaggio)
            ? 'Non hai il permesso di eliminare contabili (serve amministrazione o contabilità).'
            : messaggio,
        )
      }
    })
  }

  const listaFile =
    elencate.length > 0 ? (
      <ul className="space-y-1">
        {elencate.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-xs">
            <span aria-hidden style={{ color: 'var(--color-eco-blue-300)' }}>
              ▤
            </span>
            <a
              href={`/api/contabili/${c.id}`}
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
            <button
              type="button"
              disabled={inCorso}
              onClick={() => elimina(c.id)}
              className="ml-auto px-1 leading-none"
              style={{ color: 'var(--testo-fioco)' }}
              aria-label="Elimina la contabile"
              title={
                concessoIl
                  ? 'Revoca prima il via libera, poi elimina'
                  : 'Elimina la contabile'
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    ) : null

  if (concessoIl) {
    return (
      <div className="mt-2 space-y-2">
        {listaFile}
        <div className="text-xs">
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
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {listaFile}

      <div className="flex flex-wrap items-center gap-2">
        <ScegliFile
          onFile={carica}
          disabled={inCorso}
          etichetta={
            inCorso
              ? 'Caricamento…'
              : elencate.length > 0
                ? '+ Altra contabile'
                : '+ Contabile'
          }
        />

        <button
          type="button"
          disabled={inCorso || elencate.length === 0}
          title={
            elencate.length === 0
              ? 'Carica prima la contabile ricevuta dal cliente'
              : undefined
          }
          onClick={() =>
            esegui(async () => {
              setErrore(null)
              try {
                const esito = await concediOkAmministrativo({ milestoneId })
                if (esito.ok) {
                  avvisa('Via libera amministrativo concesso.')
                  router.refresh()
                } else {
                  setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
                }
              } catch (errore) {
                const messaggio =
                  errore instanceof Error ? errore.message : 'Operazione non riuscita.'
                setErrore(
                  /accesso non consentito/i.test(messaggio)
                    ? 'Non hai il permesso di concedere il via libera (serve amministrazione o contabilità).'
                    : messaggio,
                )
              }
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
