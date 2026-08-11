'use client'

import { useState, useTransition } from 'react'
import { ripristinaDalCestino, riprovaOperazioniFallite } from '@/lib/actions/manutenzione'

export interface EventoFallitoInElenco {
  readonly id: string
  readonly descrizione: string
  readonly tentativi: number
  readonly errore: string | null
  readonly creatoIl: string
}

export interface CestinatoInElenco {
  readonly id: string
  readonly genere: 'documento' | 'contabile' | 'fotografia'
  readonly nome: string
  readonly contesto: string
  readonly eliminatoIl: string
  readonly eliminatoDa: string | null
  readonly dimensione: string
}

const ETICHETTA_GENERE: Record<CestinatoInElenco['genere'], string> = {
  documento: 'Documento',
  contabile: 'Contabile',
  fotografia: 'Fotografia',
}

export function PannelloManutenzione({
  eventi,
  cestino,
  pesoCestino,
}: {
  eventi: readonly EventoFallitoInElenco[]
  cestino: readonly CestinatoInElenco[]
  pesoCestino: string
}) {
  return (
    <div className="space-y-8">
      <OperazioniFallite eventi={eventi} />
      <Cestino elementi={cestino} peso={pesoCestino} />
    </div>
  )
}

function OperazioniFallite({ eventi }: { eventi: readonly EventoFallitoInElenco[] }) {
  const [esito, setEsito] = useState<string | null>(null)
  const [inCorso, avvia] = useTransition()

  return (
    <section>
      <h3 className="text-sm font-semibold">Operazioni che si sono arrese</h3>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
        Copie su Drive e messaggi che hanno smesso di riprovare dopo molti tentativi.
        Nessun dato è andato perso: manca solo l&apos;effetto. Sistemata la causa,
        rimettile in coda.
      </p>

      {eventi.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--testo-fioco)' }}>
          Nessuna. Tutto quello che doveva partire è partito.
        </p>
      ) : (
        <ul
          className="mt-4 divide-y rounded-lg border"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {eventi.map((e) => (
            <li key={e.id} className="px-4 py-3" style={{ borderColor: 'var(--bordo-tenue)' }}>
              <div className="text-sm">{e.descrizione}</div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
                {e.creatoIl} · {e.tentativi} tentativi
              </div>
              {e.errore ? (
                <div
                  className="mt-1 font-mono text-xs break-words"
                  style={{ color: '#e8a0a0' }}
                >
                  {e.errore}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {eventi.length > 0 ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={inCorso}
            onClick={() => {
              setEsito(null)
              avvia(async () => {
                const r = await riprovaOperazioniFallite()
                setEsito(
                  r.ok
                    ? `${r.data.rimessi} rimesse in coda.`
                    : (r.errors._ ?? 'Non riuscito.'),
                )
              })
            }}
            className="rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-3 py-1.5 text-xs font-semibold text-eco-abisso disabled:opacity-60"
          >
            {inCorso ? 'In corso…' : 'Rimetti in coda'}
          </button>
          {esito ? (
            <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              {esito}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function Cestino({
  elementi,
  peso,
}: {
  elementi: readonly CestinatoInElenco[]
  peso: string
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold">Cestino</h3>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
        Niente viene mai cancellato davvero. Quello che è stato eliminato resta qui
        senza scadenza e si riprende con un clic, anche a mesi di distanza.
        {elementi.length > 0 ? ` Occupa ${peso}.` : ''}
      </p>

      {elementi.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--testo-fioco)' }}>
          Vuoto.
        </p>
      ) : (
        <ul
          className="mt-4 divide-y rounded-lg border"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {elementi.map((el) => (
            <RigaCestino key={`${el.genere}-${el.id}`} elemento={el} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RigaCestino({ elemento }: { elemento: CestinatoInElenco }) {
  const [errore, setErrore] = useState<string | null>(null)
  const [fatto, setFatto] = useState(false)
  const [inCorso, avvia] = useTransition()

  return (
    <li
      className="flex items-center justify-between gap-4 px-4 py-3"
      style={{ borderColor: 'var(--bordo-tenue)' }}
    >
      <div className="min-w-0">
        <div className="truncate text-sm">{elemento.nome}</div>
        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          {ETICHETTA_GENERE[elemento.genere]} · {elemento.contesto} · eliminato il{' '}
          {elemento.eliminatoIl}
          {elemento.eliminatoDa ? ` da ${elemento.eliminatoDa}` : ''} ·{' '}
          {elemento.dimensione}
        </div>
        {errore ? (
          <div className="mt-1 text-xs text-eco-red-400">{errore}</div>
        ) : null}
      </div>

      {fatto ? (
        <span className="shrink-0 text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Ripristinato
        </span>
      ) : (
        <button
          type="button"
          disabled={inCorso}
          onClick={() => {
            setErrore(null)
            avvia(async () => {
              const r = await ripristinaDalCestino({
                genere: elemento.genere,
                id: elemento.id,
              })
              if (r.ok) setFatto(true)
              else setErrore(r.errors._ ?? 'Ripristino non riuscito.')
            })
          }}
          className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {inCorso ? 'Ripristino…' : 'Ripristina'}
        </button>
      )}
    </li>
  )
}
