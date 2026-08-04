'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui'
import { createUser, updateUser } from '@/lib/actions/admin'
import type { Role } from '@/lib/auth/policy'

const RUOLI: readonly { value: Role; label: string; descrizione: string }[] = [
  { value: 'amministratore', label: 'Amministratore', descrizione: 'Accesso completo, configurazioni, utenti, audit' },
  { value: 'contabilita', label: 'Contabilita', descrizione: 'Fatture, pagamenti, documenti, pratiche' },
  { value: 'commerciale', label: 'Commerciale', descrizione: 'Lead, opportunita, sopralluoghi, preventivi' },
  { value: 'cantiere', label: 'Cantiere', descrizione: 'Materiali, pianificazione, esecuzione, rapportini' },
]

export interface UtenteInElenco {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly role: Role
  readonly canViewCosts: boolean
  readonly isFieldOnly: boolean
  readonly isActive: boolean
}

export function GestioneUtenti({
  utenti,
  utenteCorrenteId,
}: {
  utenti: readonly UtenteInElenco[]
  utenteCorrenteId: string
}) {
  return (
    <div className="space-y-6">
      <NuovoUtente />
      <div className="space-y-3">
        {utenti.map((u) => (
          <RigaUtente key={u.id} utente={u} eSeStesso={u.id === utenteCorrenteId} />
        ))}
      </div>
    </div>
  )
}

function NuovoUtente() {
  const [aperto, setAperto] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [ruolo, setRuolo] = useState<Role>('commerciale')
  const [inCorso, avvia] = useTransition()

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="rounded-md bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso hover:opacity-90"
      >
        Abilita un utente
      </button>
    )
  }

  return (
    <form
      action={(formData) => {
        setErrors({})
        avvia(async () => {
          const esito = await createUser({
            email: String(formData.get('email') ?? ''),
            name: String(formData.get('name') ?? '') || undefined,
            role: ruolo,
            canViewCosts: formData.get('canViewCosts') === 'on',
            isFieldOnly: formData.get('isFieldOnly') === 'on',
          })
          if (esito.ok) {
            setAperto(false)
            setRuolo('commerciale')
          } else setErrors(esito.errors)
        })
      }}
      className="space-y-4 rounded-lg border p-4"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Non serve una password: la persona entra con il proprio account Google aziendale.
        Questa abilitazione è ciò che glielo consente — senza, l&apos;accesso viene
        rifiutato.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Email aziendale<span className="text-eco-red-400"> *</span>
          </span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{
              background: 'var(--superficie)',
              borderColor: errors.email ? 'var(--color-eco-red-400)' : 'var(--bordo)',
            }}
          />
          {errors.email ? (
            <span className="mt-1 block text-xs text-eco-red-400">{errors.email}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome</span>
          <input
            name="name"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Ruolo</span>
        <select
          value={ruolo}
          onChange={(e) => setRuolo(e.target.value as Role)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
        >
          {RUOLI.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {RUOLI.find((r) => r.value === ruolo)?.descrizione}
        </span>
      </label>

      <Capacita ruolo={ruolo} />

      {errors._ ? <p className="text-xs text-eco-red-400">{errors._}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded-md bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
        >
          {inCorso ? 'Creazione…' : 'Abilita'}
        </button>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Annulla
        </button>
      </div>
    </form>
  )
}

function Capacita({
  ruolo,
  costiIniziale,
  campoIniziale,
}: {
  ruolo: Role
  costiIniziale?: boolean
  campoIniziale?: boolean
}) {
  const costiPerRuolo = ruolo === 'amministratore' || ruolo === 'contabilita'

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="canViewCosts"
          defaultChecked={costiIniziale ?? false}
          disabled={costiPerRuolo}
          className="mt-0.5"
        />
        <span>
          Puo vedere costi di acquisto e margine in euro
          <span className="mt-0.5 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
            {costiPerRuolo
              ? 'Sempre attivo per questo ruolo.'
              : 'Senza, vede prezzi di vendita e margine percentuale, ma non i prezzi dei fornitori.'}
          </span>
        </span>
      </label>

      {ruolo === 'cantiere' ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isFieldOnly"
            defaultChecked={campoIniziale ?? false}
            className="mt-0.5"
          />
          <span>
            Solo vista di campo
            <span className="mt-0.5 block text-xs" style={{ color: 'var(--testo-tenue)' }}>
              Per gli installatori: lavori assegnati, checklist, foto e ore. Nessun importo.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  )
}

function RigaUtente({
  utente,
  eSeStesso,
}: {
  utente: UtenteInElenco
  eSeStesso: boolean
}) {
  const [aperto, setAperto] = useState(false)
  const [ruolo, setRuolo] = useState<Role>(utente.role)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [inCorso, avvia] = useTransition()

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{utente.name ?? utente.email}</span>
            {!utente.isActive ? <Badge tone="critico">Disattivato</Badge> : null}
            {eSeStesso ? <Badge>Tu</Badge> : null}
          </div>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
            {utente.email} · {RUOLI.find((r) => r.value === utente.role)?.label}
            {utente.canViewCosts ? ' · costi visibili' : ''}
            {utente.isFieldOnly ? ' · solo campo' : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAperto(!aperto)}
          className="shrink-0 rounded border px-3 py-1 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {aperto ? 'Chiudi' : 'Modifica'}
        </button>
      </div>

      {aperto ? (
        <form
          action={(formData) => {
            setErrors({})
            avvia(async () => {
              const esito = await updateUser({
                userId: utente.id,
                role: ruolo,
                canViewCosts:
                  ruolo === 'amministratore' || ruolo === 'contabilita'
                    ? true
                    : formData.get('canViewCosts') === 'on',
                isFieldOnly: formData.get('isFieldOnly') === 'on',
                isActive: formData.get('isActive') === 'on',
              })
              if (esito.ok) setAperto(false)
              else setErrors(esito.errors)
            })
          }}
          className="mt-4 space-y-4 border-t pt-4"
          style={{ borderColor: 'var(--bordo)' }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Ruolo</span>
            <select
              value={ruolo}
              onChange={(e) => setRuolo(e.target.value as Role)}
              disabled={eSeStesso}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            >
              {RUOLI.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {errors.role ? (
              <span className="mt-1 block text-xs text-eco-red-400">{errors.role}</span>
            ) : null}
          </label>

          <Capacita
            ruolo={ruolo}
            costiIniziale={utente.canViewCosts}
            campoIniziale={utente.isFieldOnly}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={utente.isActive}
              disabled={eSeStesso}
            />
            <span>Attivo</span>
          </label>
          {errors.isActive ? (
            <span className="block text-xs text-eco-red-400">{errors.isActive}</span>
          ) : null}

          {eSeStesso ? (
            <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
              Non puoi cambiare il tuo ruolo né disattivarti: è il modo più comune di
              restare chiusi fuori dal proprio sistema.
            </p>
          ) : null}

          {errors._ ? <p className="text-xs text-eco-red-400">{errors._}</p> : null}

          <button
            type="submit"
            disabled={inCorso}
            className="rounded-md bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
          >
            {inCorso ? 'Salvataggio…' : 'Salva'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
