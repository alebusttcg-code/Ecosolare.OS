'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge, Vuoto, formattaData, formattaEuro } from '@/components/ui'
import { useAzioneServer } from '@/lib/use-azione-server'
import { emettiFattura, stornaFattura } from '@/lib/actions/fatture'
import type { FatturaElenco } from '@/lib/queries/fatture'

const ETICHETTA_STATO: Record<FatturaElenco['status'], string> = {
  bozza: 'Bozza',
  emessa: 'Emessa',
  esportata: 'Esportata',
  incassata: 'Incassata',
  stornata: 'Stornata',
}

const TONO_STATO: Record<FatturaElenco['status'], 'neutro' | 'positivo' | 'critico' | 'attenzione'> = {
  bozza: 'neutro',
  emessa: 'positivo',
  esportata: 'positivo',
  incassata: 'positivo',
  stornata: 'critico',
}

const ETICHETTA_TIPO: Record<FatturaElenco['type'], string> = {
  fattura: 'Fattura',
  acconto: 'Acconto',
  nota_credito: 'Nota di credito',
}

type FiltroStato = 'tutte' | 'bozza' | 'emesse' | 'stornata'

const FILTRI: readonly { chiave: FiltroStato; label: string }[] = [
  { chiave: 'tutte', label: 'Tutte' },
  { chiave: 'bozza', label: 'Bozze' },
  { chiave: 'emesse', label: 'Emesse' },
  { chiave: 'stornata', label: 'Storni' },
]

/** Maiuscolo/minuscolo e accenti non devono impedire un riscontro. */
function normalizza(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function combaciaStato(f: FatturaElenco, filtro: FiltroStato): boolean {
  if (filtro === 'tutte') return true
  if (filtro === 'emesse') return f.status === 'emessa' || f.status === 'esportata' || f.status === 'incassata'
  if (filtro === 'bozza') return f.status === 'bozza'
  return f.status === 'stornata'
}

/**
 * Elenco delle fatture con ricerca istantanea.
 *
 * La ricerca è forte di proposito: normalizza accenti e maiuscole e lavora per
 * sottostringa su nome cliente, numero, codice commessa e P.IVA/CF — così
 * digitando «Esp» compaiono subito le fatture a «Esposito». Ogni parola digitata
 * è un vincolo in più (AND), per stringere invece di allargare.
 */
export function ElencoFatture({ fatture }: { fatture: readonly FatturaElenco[] }) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<FiltroStato>('tutte')
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  // Fieno di ricerca precalcolato una volta sola per fattura.
  const conFieno = useMemo(
    () =>
      fatture.map((f) => ({
        f,
        fieno: normalizza(
          [f.cliente, f.displayNumber ?? '', f.projectCode ?? '', f.partitaIva ?? '', f.codiceFiscale ?? '']
            .join(' '),
        ),
      })),
    [fatture],
  )

  const risultati = useMemo(() => {
    const termini = normalizza(query).split(/\s+/).filter(Boolean)
    return conFieno
      .filter(({ f }) => combaciaStato(f, filtro))
      .filter(({ fieno }) => termini.every((t) => fieno.includes(t)))
      .map(({ f }) => f)
  }, [conFieno, query, filtro])

  function azione(
    fn: () => Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>,
    messaggioOk: string,
  ) {
    setErrore(null)
    esegui(async () => {
      try {
        const esito = await fn()
        if (esito.ok) {
          avvisa(messaggioOk)
          router.refresh()
        } else {
          setErrore(Object.values(esito.errors)[0] ?? 'Operazione non riuscita.')
        }
      } catch (e) {
        const messaggio = e instanceof Error ? e.message : 'Operazione non riuscita.'
        setErrore(
          /accesso non consentito/i.test(messaggio)
            ? 'Non hai il permesso di gestire le fatture.'
            : messaggio,
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Ricerca + filtri: in colonna su mobile, in riga da sm in su. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputMode="search"
          autoFocus
          placeholder="Cerca per cliente, numero, commessa, P.IVA…"
          aria-label="Cerca fatture"
          className="w-full rounded-lg border px-3 py-2 text-sm transition-colors duration-200 outline-none focus:border-eco-blue-400 sm:flex-1"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTRI.map((v) => {
            const attivo = v.chiave === filtro
            return (
              <button
                key={v.chiave}
                type="button"
                onClick={() => setFiltro(v.chiave)}
                aria-pressed={attivo}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  borderColor: attivo ? 'rgba(91,155,213,0.55)' : 'var(--bordo)',
                  background: attivo ? 'rgba(91,155,213,0.14)' : 'transparent',
                  color: attivo ? 'var(--color-eco-blue-300)' : 'var(--testo-tenue)',
                }}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {errore ? (
        <p
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'rgba(224,133,133,0.42)', background: 'rgba(224,133,133,0.08)', color: '#f0c9c9' }}
        >
          {errore}
        </p>
      ) : null}

      <p className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
        {risultati.length} {risultati.length === 1 ? 'fattura' : 'fatture'}
        {query || filtro !== 'tutte' ? ` su ${fatture.length}` : ''}
      </p>

      {risultati.length === 0 ? (
        <Vuoto
          messaggio={
            fatture.length === 0
              ? 'Nessuna fattura ancora. Le fatture nascono da una scadenza del piano pagamenti, nella scheda del cantiere.'
              : `Nessun risultato per questi filtri.`
          }
        />
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
          {risultati.map((f) => (
            <li key={f.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                {/* Identità della fattura */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {f.displayNumber ?? 'Bozza'}
                    </span>
                    {f.type !== 'fattura' ? (
                      <Badge tone="attenzione">{ETICHETTA_TIPO[f.type]}</Badge>
                    ) : null}
                    <Badge tone={TONO_STATO[f.status]}>{ETICHETTA_STATO[f.status]}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-sm" style={{ color: 'var(--testo)' }}>
                    {f.cliente}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    <span>{formattaData(f.dataDocumento ?? f.createdAt)}</span>
                    {f.partitaIva ? <span>· P.IVA {f.partitaIva}</span> : f.codiceFiscale ? <span>· CF {f.codiceFiscale}</span> : null}
                    {f.projectId && f.projectCode ? (
                      <Link
                        href={`/cantieri/${f.projectId}`}
                        prefetch={false}
                        className="collega"
                        style={{ color: 'var(--color-eco-blue-300)' }}
                      >
                        · {f.projectCode}
                      </Link>
                    ) : null}
                  </div>
                </div>

                {/* Totale */}
                <div className="text-sm font-semibold tabular-nums sm:w-32 sm:text-right">
                  {formattaEuro(f.totale)}
                </div>

                {/* Azioni: a capo su mobile, allineate a destra da sm */}
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {f.displayNumber ? (
                    <a
                      href={`/api/fatture/${f.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-2.5 py-1.5 text-xs"
                      style={{ borderColor: 'var(--bordo)', color: 'var(--color-eco-blue-300)' }}
                    >
                      PDF
                    </a>
                  ) : null}
                  {f.status === 'bozza' ? (
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() => azione(() => emettiFattura(f.id), 'Fattura emessa.')}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)', color: '#050a14' }}
                    >
                      Emetti
                    </button>
                  ) : null}
                  {f.status === 'emessa' || f.status === 'esportata' || f.status === 'incassata' ? (
                    <button
                      type="button"
                      disabled={inCorso}
                      onClick={() => azione(() => stornaFattura(f.id), 'Nota di credito emessa.')}
                      className="bottone-fantasma rounded-lg border px-2.5 py-1.5 text-xs disabled:opacity-40"
                      style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
                    >
                      Storna
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
