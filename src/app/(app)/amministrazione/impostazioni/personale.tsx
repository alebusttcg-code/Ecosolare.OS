'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useAvvisi } from '@/components/avvisi'
import { Badge } from '@/components/ui'
import {
  aggiornaOperaio,
  creaOperaio,
  disattivaOperaio,
  riattivaOperaio,
} from '@/lib/actions/schedule'
import type { OperaioInElenco } from '@/lib/queries/schedule'
import { useAzioneServer } from '@/lib/use-azione-server'

/**
 * Anagrafica squadra cantiere (senza login), dentro Impostazioni.
 * Chi ha accesso al gestionale resta in Amministrazione → Utenti.
 */
export function GestionePersonale({
  personale,
  puoScrivere,
}: {
  personale: readonly OperaioInElenco[]
  puoScrivere: boolean
}) {
  const [filtro, setFiltro] = useState<'attivi' | 'tutti'>('attivi')

  const attivi = useMemo(() => personale.filter((d) => d.isActive), [personale])
  const disattivati = useMemo(() => personale.filter((d) => !d.isActive), [personale])
  const visibili = useMemo(
    () => (filtro === 'attivi' ? attivi : [...attivi, ...disattivati]),
    [filtro, attivi, disattivati],
  )

  return (
    <div className="space-y-5">
      <div
        className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"
        style={{ borderColor: 'var(--bordo-tenue)' }}
      >
        <div className="min-w-0 space-y-2">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
            Nomi da assegnare ai cantieri in Agenda. Non hanno login:{' '}
            <Link
              href="/amministrazione/utenti"
              className="text-eco-blue-300 underline-offset-2 hover:underline collega"
            >
              gli accessi al gestionale sono in Utenti
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            <span className="tabular-nums">
              <span className="font-medium text-eco-gold-300">{attivi.length}</span> in squadra
            </span>
            {disattivati.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{disattivati.length} disattivati</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {disattivati.length > 0 ? (
            <div
              className="flex rounded-lg border p-0.5"
              style={{ borderColor: 'var(--bordo)', background: 'rgba(5,10,20,0.45)' }}
              role="group"
              aria-label="Filtro elenco"
            >
              <FiltroChip
                attivo={filtro === 'attivi'}
                onClick={() => setFiltro('attivi')}
                label="In squadra"
              />
              <FiltroChip
                attivo={filtro === 'tutti'}
                onClick={() => setFiltro('tutti')}
                label="Tutti"
              />
            </div>
          ) : null}
          {puoScrivere ? <NuovoDipendente /> : null}
        </div>
      </div>

      {personale.length === 0 ? (
        <div className="px-1 py-10 text-center">
          <p className="text-sm font-medium">Nessuno in anagrafica</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed" style={{ color: 'var(--testo-fioco)' }}>
            Aggiungi il primo operaio o dipendente di cantiere: servirà quando pianifichi un’installazione.
          </p>
        </div>
      ) : visibili.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--testo-fioco)' }}>
          Nessuno in squadra. Passa a «Tutti» per vedere i disattivati.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
          {visibili.map((d) => (
            <RigaDipendente key={d.id} dipendente={d} puoScrivere={puoScrivere} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FiltroChip({
  attivo,
  onClick,
  label,
}: {
  attivo: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200"
      style={
        attivo
          ? { background: 'rgba(232,199,101,0.16)', color: 'var(--color-eco-gold-300)' }
          : { color: 'var(--testo-tenue)' }
      }
    >
      {label}
    </button>
  )
}

function NuovoDipendente() {
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
        className="bottone-oro shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        Aggiungi alla squadra
      </button>
    )
  }

  return (
    <form
      className="w-full basis-full space-y-3 rounded-xl border p-4 sm:order-last"
      style={{
        background: 'linear-gradient(165deg, rgba(232,199,101,0.07) 0%, rgba(5,10,20,0.55) 55%)',
        borderColor: 'rgba(217,164,65,0.35)',
      }}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        setErrors({})
        esegui(async () => {
          const esito = await creaOperaio({
            firstName: String(fd.get('firstName') ?? ''),
            lastName: String(fd.get('lastName') ?? ''),
            phone: String(fd.get('phone') ?? '') || undefined,
          })
          if (!esito.ok) {
            setErrors(esito.errors)
            return
          }
          avvisa('Aggiunto alla squadra.')
          setAperto(false)
          router.refresh()
        })
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Nuovo in squadra</p>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="text-xs"
          style={{ color: 'var(--testo-fioco)' }}
        >
          Chiudi
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo nome="firstName" label="Nome" errore={errors.firstName} required />
        <Campo nome="lastName" label="Cognome" errore={errors.lastName} required />
        <Campo nome="phone" label="Telefono" errore={errors.phone} />
      </div>
      {errors._ ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errors._}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={inCorso}
        className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        {inCorso ? 'Salvataggio…' : 'Salva'}
      </button>
    </form>
  )
}

function iniziali(nome: string): string {
  const pezzi = nome.trim().split(/\s+/).filter(Boolean)
  if (pezzi.length === 0) return '?'
  if (pezzi.length === 1) return pezzi[0]!.slice(0, 2).toUpperCase()
  return `${pezzi[0]![0] ?? ''}${pezzi[pezzi.length - 1]![0] ?? ''}`.toUpperCase()
}

function RigaDipendente({
  dipendente,
  puoScrivere,
}: {
  dipendente: OperaioInElenco
  puoScrivere: boolean
}) {
  const router = useRouter()
  const avvisa = useAvvisi()
  const [aperto, setAperto] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { inCorso, esegui } = useAzioneServer()

  return (
    <li className={`py-3.5 first:pt-0 last:pb-0 ${dipendente.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide"
          style={{
            background: dipendente.isActive
              ? 'rgba(91,155,213,0.14)'
              : 'rgba(255,255,255,0.04)',
            color: dipendente.isActive ? 'var(--color-eco-blue-300)' : 'var(--testo-fioco)',
            border: `1px solid ${dipendente.isActive ? 'rgba(91,155,213,0.28)' : 'var(--bordo-tenue)'}`,
          }}
          aria-hidden
        >
          {iniziali(dipendente.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{dipendente.name}</span>
            {dipendente.isActive ? (
              <Badge tone="positivo">In squadra</Badge>
            ) : (
              <Badge tone="critico">Disattivato</Badge>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs" style={{ color: 'var(--testo-tenue)' }}>
            {dipendente.phone ? dipendente.phone : 'Nessun telefono'}
          </div>
        </div>

        {puoScrivere ? (
          <button
            type="button"
            onClick={() => setAperto(!aperto)}
            className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--bordo)' }}
            aria-expanded={aperto}
          >
            {aperto ? 'Chiudi' : 'Modifica'}
          </button>
        ) : null}
      </div>

      {aperto && puoScrivere ? (
        <form
          className="mt-3 space-y-3 rounded-xl border p-4"
          style={{
            borderColor: 'var(--bordo)',
            background: 'rgba(5,10,20,0.4)',
          }}
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            setErrors({})
            esegui(async () => {
              const esito = await aggiornaOperaio({
                id: dipendente.id,
                firstName: String(fd.get('firstName') ?? ''),
                lastName: String(fd.get('lastName') ?? ''),
                phone: String(fd.get('phone') ?? '') || undefined,
              })
              if (!esito.ok) {
                setErrors(esito.errors)
                return
              }
              avvisa('Scheda aggiornata.')
              setAperto(false)
              router.refresh()
            })
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              nome="firstName"
              label="Nome"
              defaultValue={dipendente.firstName}
              errore={errors.firstName}
              required
            />
            <Campo
              nome="lastName"
              label="Cognome"
              defaultValue={dipendente.lastName}
              errore={errors.lastName}
              required
            />
            <Campo
              nome="phone"
              label="Telefono"
              defaultValue={dipendente.phone ?? ''}
              errore={errors.phone}
            />
          </div>
          {errors._ ? (
            <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
              {errors._}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={inCorso}
              className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
                color: '#050a14',
              }}
            >
              {inCorso ? 'Salvataggio…' : 'Salva'}
            </button>
            {dipendente.isActive ? (
              <button
                type="button"
                disabled={inCorso}
                onClick={() =>
                  esegui(async () => {
                    const esito = await disattivaOperaio({ id: dipendente.id })
                    if (!esito.ok) {
                      setErrors(esito.errors)
                      return
                    }
                    avvisa('Rimosso dalla squadra attiva.')
                    setAperto(false)
                    router.refresh()
                  })
                }
                className="bottone-fantasma rounded-lg border px-3 py-2 text-xs disabled:opacity-60"
                style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
              >
                Disattiva
              </button>
            ) : (
              <button
                type="button"
                disabled={inCorso}
                onClick={() =>
                  esegui(async () => {
                    const esito = await riattivaOperaio({ id: dipendente.id })
                    if (!esito.ok) {
                      setErrors(esito.errors)
                      return
                    }
                    avvisa('Di nuovo in squadra.')
                    setAperto(false)
                    router.refresh()
                  })
                }
                className="bottone-fantasma rounded-lg border px-3 py-2 text-xs disabled:opacity-60"
                style={{ borderColor: 'rgba(163,197,99,0.45)', color: 'var(--color-eco-green-400)' }}
              >
                Rimetti in squadra
              </button>
            )}
          </div>
        </form>
      ) : null}
    </li>
  )
}

function Campo({
  nome,
  label,
  defaultValue,
  errore,
  required,
}: {
  nome: string
  label: string
  defaultValue?: string
  errore?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--testo-tenue)' }}>
        {label}
        {required ? <span style={{ color: 'var(--color-eco-gold-400)' }}> *</span> : null}
      </span>
      <input
        name={nome}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
        style={{
          background: 'rgba(5,10,20,0.6)',
          borderColor: errore ? 'var(--color-eco-red-400)' : 'var(--bordo)',
        }}
      />
      {errore ? (
        <span className="mt-1 block text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errore}
        </span>
      ) : null}
    </label>
  )
}
