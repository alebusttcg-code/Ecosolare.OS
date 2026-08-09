'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui'
import { useAzioneServer } from '@/lib/use-azione-server'
import { createUser, resetPassword, updateUser } from '@/lib/actions/admin'
import type { Role } from '@/lib/auth/policy'

const RUOLI: readonly { value: Role; label: string; descrizione: string }[] = [
  { value: 'amministratore', label: 'Amministratore', descrizione: 'Accesso completo, impostazioni, utenti, audit' },
  { value: 'contabilita', label: 'Contabilità', descrizione: 'Fatture, pagamenti, documenti, pratiche' },
  { value: 'commerciale', label: 'Commerciale', descrizione: 'Lead, sopralluoghi, preventivi e firme' },
  {
    value: 'cantiere',
    label: 'Operativo',
    descrizione: 'Cantieri, materiali, pianificazione e assegnazione operai',
  },
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
  const [credenziali, setCredenziali] = useState<{ email: string; password: string } | null>(
    null,
  )
  const { inCorso, esegui } = useAzioneServer()

  if (credenziali) {
    return (
      <CredenzialiGenerate
        email={credenziali.email}
        password={credenziali.password}
        onChiudi={() => setCredenziali(null)}
      />
    )
  }

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
        const email = String(formData.get('email') ?? '')
        esegui(async () => {
          const esito = await createUser({
            email,
            name: String(formData.get('name') ?? '') || undefined,
            role: ruolo,
            canViewCosts: formData.get('canViewCosts') === 'on',
            isFieldOnly: formData.get('isFieldOnly') === 'on',
          })
          if (esito.ok) {
            setAperto(false)
            setRuolo('commerciale')
            setCredenziali({ email, password: esito.data.passwordIniziale })
          } else setErrors(esito.errors)
        })
      }}
      className="space-y-4 rounded-lg border p-4"
      style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
    >
      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        La password iniziale la genera il sistema e te la mostra una volta sola: dovrai
        comunicarla alla persona, che la cambierà al primo accesso. Non è recuperabile
        in seguito, ma si può rigenerare.
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
            className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
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
            className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Ruolo</span>
        <select
          value={ruolo}
          onChange={(e) => setRuolo(e.target.value as Role)}
          className="w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
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
          className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
        >
          {inCorso ? 'Creazione…' : 'Abilita'}
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

/**
 * Le credenziali appena generate, mostrate una volta sola.
 *
 * Restano a schermo finché non si chiude esplicitamente il riquadro: un
 * messaggio che sparisce da solo farebbe perdere la password, e riaverla
 * significa rigenerarla.
 */
function CredenzialiGenerate({
  email,
  password,
  onChiudi,
}: {
  email: string
  password: string
  onChiudi: () => void
}) {
  const [copiato, setCopiato] = useState(false)

  return (
    <div
      className="space-y-3 rounded-lg border p-4"
      style={{ borderColor: 'rgba(232,199,101,0.45)', background: 'rgba(232,199,101,0.07)' }}
    >
      <p className="text-sm font-semibold">Credenziali da consegnare</p>

      <div className="space-y-1 font-mono text-sm">
        <div>{email}</div>
        <div className="text-eco-gold-300 select-all">{password}</div>
      </div>

      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Questa password non sarà più visibile: nel database ne resta solo l&apos;impronta.
        Comunicala a voce o su un canale diverso dall&apos;email di accesso. Al primo
        ingresso il sistema le chiederà di sceglierne una nuova.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(password).then(() => setCopiato(true))
          }}
          className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {copiato ? 'Copiata' : 'Copia password'}
        </button>
        <button
          type="button"
          onClick={onChiudi}
          className="rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-3 py-1.5 text-xs font-semibold text-eco-abisso"
        >
          Fatto, l&apos;ho annotata
        </button>
      </div>
    </div>
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

      {/* Gli operai non hanno login: is_field_only resta in schema per compatibilità
          ma non si propone più in UI. */}
      {campoIniziale ? <input type="hidden" name="isFieldOnly" value="on" /> : null}
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
  const { inCorso, esegui } = useAzioneServer()

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
          className="bottone-fantasma shrink-0 rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {aperto ? 'Chiudi' : 'Modifica'}
        </button>
      </div>

      {aperto ? (
        <form
          action={(formData) => {
            setErrors({})
            esegui(async () => {
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
            className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
          >
            {inCorso ? 'Salvataggio…' : 'Salva'}
          </button>
        </form>
      ) : null}

      {aperto ? <RigeneraPassword utente={utente} /> : null}
    </div>
  )
}

/**
 * Rigenerazione della password. Separata dal modulo dei permessi perché non è
 * una modifica come le altre: chiude tutte le sessioni della persona e la
 * lascia fuori finché non riceve la nuova password.
 */
function RigeneraPassword({ utente }: { utente: UtenteInElenco }) {
  const [nuova, setNuova] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()

  if (nuova) {
    return (
      <div className="mt-4">
        <CredenzialiGenerate
          email={utente.email}
          password={nuova}
          onChiudi={() => setNuova(null)}
        />
      </div>
    )
  }

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--bordo)' }}>
      <button
        type="button"
        disabled={inCorso}
        onClick={() => {
          setErrore(null)
          esegui(async () => {
            const esito = await resetPassword({ userId: utente.id })
            if (esito.ok) setNuova(esito.data.passwordIniziale)
            else setErrore(esito.errors._ ?? 'Operazione non riuscita.')
          })
        }}
        className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
        style={{ borderColor: 'var(--bordo)' }}
      >
        {inCorso ? 'Rigenerazione…' : 'Rigenera la password'}
      </button>
      <p className="mt-1 text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Chiude tutte le sue sessioni aperte. Da usare quando la password è stata
        dimenticata o si sospetta che qualcun altro la conosca.
      </p>
      {errore ? <p className="mt-1 text-xs text-eco-red-400">{errore}</p> : null}
    </div>
  )
}
