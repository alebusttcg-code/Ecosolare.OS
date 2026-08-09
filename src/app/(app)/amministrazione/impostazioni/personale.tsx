'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
 * Anagrafica dipendenti senza login (operai e simili), dentro Impostazioni.
 * La gestione utenti con accesso al gestionale resta in Amministrazione → Utenti.
 */
export function GestionePersonale({
  personale,
  puoScrivere,
}: {
  personale: readonly OperaioInElenco[]
  puoScrivere: boolean
}) {
  return (
    <div className="space-y-6">
      {puoScrivere ? <NuovoDipendente /> : null}
      {personale.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--testo-fioco)' }}>
          Nessun dipendente in anagrafica. Aggiungine uno per poterlo assegnare ai cantieri.
        </p>
      ) : (
        <ul className="space-y-3">
          {personale.map((d) => (
            <RigaDipendente key={d.id} dipendente={d} puoScrivere={puoScrivere} />
          ))}
        </ul>
      )}
    </div>
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
        className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        Nuovo dipendente
      </button>
    )
  }

  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
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
          avvisa('Dipendente aggiunto.')
          setAperto(false)
          router.refresh()
        })
      }}
    >
      <p className="text-sm font-medium">Nuovo dipendente</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="firstName" label="Nome" errore={errors.firstName} required />
        <Campo nome="lastName" label="Cognome" errore={errors.lastName} required />
      </div>
      <Campo nome="phone" label="Telefono" errore={errors.phone} />
      {errors._ ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errors._}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
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
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
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
    <li
      className="rounded-lg border p-4"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{dipendente.name}</span>
            {!dipendente.isActive ? <Badge tone="critico">Disattivato</Badge> : null}
          </div>
          {dipendente.phone ? (
            <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
              {dipendente.phone}
            </div>
          ) : null}
        </div>
        {puoScrivere ? (
          <button
            type="button"
            onClick={() => setAperto(!aperto)}
            className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            {aperto ? 'Chiudi' : 'Modifica'}
          </button>
        ) : null}
      </div>

      {aperto && puoScrivere ? (
        <form
          className="mt-4 space-y-3 border-t pt-4"
          style={{ borderColor: 'var(--bordo-tenue)' }}
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
              avvisa('Dipendente aggiornato.')
              setAperto(false)
              router.refresh()
            })
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <Campo
            nome="phone"
            label="Telefono"
            defaultValue={dipendente.phone ?? ''}
            errore={errors.phone}
          />
          {errors._ ? (
            <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
              {errors._}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
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
                    avvisa('Dipendente disattivato.')
                    router.refresh()
                  })
                }
                className="bottone-fantasma rounded-lg border px-4 py-2 text-sm disabled:opacity-60"
                style={{ borderColor: 'var(--bordo)' }}
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
                    avvisa('Dipendente riattivato.')
                    router.refresh()
                  })
                }
                className="bottone-fantasma rounded-lg border px-4 py-2 text-sm disabled:opacity-60"
                style={{ borderColor: 'var(--bordo)' }}
              >
                Riattiva
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
      <span className="mb-1.5 block text-sm font-medium">
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
