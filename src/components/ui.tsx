import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { Contatore } from './contatore'
import { Inclina } from './inclina'

/**
 * Primitive di interfaccia.
 *
 * Profondita' e movimento seguono una regola sola: rispondono a cio' che
 * l'utente fa, non intrattengono da soli. Le classi di animazione stanno in
 * globals.css, qui si applicano.
 */

/** Ritardo per lo scaglionamento d'ingresso. */
export const ritardo = (indice: number, passo = 60): CSSProperties =>
  ({ '--ritardo': `${indice * passo}ms` }) as CSSProperties

export function Intestazione({
  eyebrow,
  titolo,
  sottotitolo,
  azione,
  titoloOro = false,
}: {
  eyebrow?: string
  titolo: string
  sottotitolo?: string
  azione?: ReactNode
  /** Sfumatura oro→blu sul titolo: per i momenti d'ingresso, non per il lavoro. */
  titoloOro?: boolean
}) {
  return (
    <div className="rivela mb-6 lg:mb-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1.5 eyebrow">{eyebrow}</p> : null}
          <h1
            className={`text-xl font-semibold tracking-tight sm:text-2xl ${
              titoloOro ? 'titolo-oro' : ''
            }`}
          >
            {titolo}
          </h1>
          {sottotitolo ? (
            <p className="mt-1.5 text-sm" style={{ color: 'var(--testo-tenue)' }}>
              {sottotitolo}
            </p>
          ) : null}
        </div>
        {azione ? <div className="shrink-0">{azione}</div> : null}
      </div>
      <div className="mt-4 filetto barra-cresce" />
    </div>
  )
}

export function Card({
  title,
  action,
  accento = 'neutro',
  interattivo = false,
  indice = 0,
  children,
}: {
  title?: string
  action?: ReactNode
  accento?: 'neutro' | 'blu' | 'oro' | 'verde' | 'rosso'
  /** Solo per i pannelli che portano da qualche parte: si sollevano al hover. */
  interattivo?: boolean
  indice?: number
  children: ReactNode
}) {
  const bordi: Record<string, string> = {
    neutro: 'var(--bordo)',
    blu: 'rgba(91,155,213,0.4)',
    oro: 'rgba(217,164,65,0.45)',
    verde: 'rgba(163,197,99,0.4)',
    rosso: 'rgba(224,133,133,0.4)',
  }

  return (
    <section
      className={`pannello rivela ${interattivo ? 'pannello-interattivo' : ''}`}
      style={{ borderColor: bordi[accento], ...ritardo(indice) }}
    >
      {title ? (
        <header
          className="flex items-center justify-between gap-4 border-b px-5 py-3.5"
          style={{ borderColor: 'var(--bordo-tenue)' }}
        >
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  formato = 'intero',
  hint,
  tone = 'neutro',
  icona,
  indice = 0,
  href,
}: {
  label: string
  value: number
  formato?: 'intero' | 'euro'
  hint?: string
  tone?: 'neutro' | 'positivo' | 'attenzione' | 'critico'
  icona?: string
  indice?: number
  /** Se presente, la card diventa un collegamento alla sezione. */
  href?: string
}) {
  const colori: Record<string, string> = {
    neutro: 'var(--color-eco-blue-300)',
    positivo: 'var(--color-eco-green-400)',
    attenzione: 'var(--color-eco-gold-300)',
    critico: 'var(--color-eco-red-400)',
  }
  const colore = colori[tone] ?? colori.neutro!

  const corpo = (
    <div
      className={`pannello relative flex h-full min-h-[8.25rem] flex-col px-5 py-4 ${href ? 'pannello-interattivo' : ''}`}
      style={ritardo(indice)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs leading-snug" style={{ color: 'var(--testo-tenue)' }}>
          {label}
        </span>
        {icona ? (
          <span
            className="anello h-7 w-7 shrink-0 text-xs"
            style={{ color: colore }}
            aria-hidden
          >
            {icona}
          </span>
        ) : null}
      </div>
      <div
        className="mt-2 flex-1 text-3xl font-semibold leading-none tracking-tight tabular-nums"
        style={{ color: tone === 'neutro' ? 'var(--testo)' : colore }}
      >
        <Contatore valore={value} formato={formato} />
      </div>
      <p
        className="mt-2 min-h-[2rem] text-xs leading-snug"
        style={{ color: 'var(--testo-fioco)' }}
        aria-hidden={!hint}
      >
        {hint ?? '\u00A0'}
      </p>
    </div>
  )

  return (
    <Inclina className="rivela h-full">
      {href ? (
        <Link href={href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-eco-blue-400/40 rounded-[inherit]">
          {corpo}
        </Link>
      ) : (
        corpo
      )}
    </Inclina>
  )
}

export function Badge({
  children,
  tone = 'neutro',
}: {
  children: ReactNode
  tone?: 'neutro' | 'positivo' | 'attenzione' | 'critico' | 'blu'
}) {
  const stili: Record<string, { bg: string; fg: string; bd: string }> = {
    neutro: { bg: 'rgba(142,163,189,0.10)', fg: '#a9bdd6', bd: 'rgba(142,163,189,0.28)' },
    blu: { bg: 'rgba(91,155,213,0.12)', fg: '#7fb2e8', bd: 'rgba(91,155,213,0.35)' },
    positivo: { bg: 'rgba(163,197,99,0.12)', fg: '#b5d47c', bd: 'rgba(163,197,99,0.35)' },
    attenzione: { bg: 'rgba(217,164,65,0.12)', fg: '#e8c765', bd: 'rgba(217,164,65,0.38)' },
    critico: { bg: 'rgba(224,133,133,0.12)', fg: '#e8a0a0', bd: 'rgba(224,133,133,0.38)' },
  }
  const s = stili[tone] ?? stili.neutro!

  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-shadow duration-200"
      style={{
        background: s.bg,
        color: s.fg,
        borderColor: s.bd,
        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.05)`,
      }}
    >
      {children}
    </span>
  )
}

export function Vuoto({ messaggio }: { messaggio: string }) {
  return (
    <p className="py-10 text-center text-sm" style={{ color: 'var(--testo-fioco)' }}>
      {messaggio}
    </p>
  )
}

export function Campo({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  errore,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  errore?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span style={{ color: 'var(--color-eco-gold-400)' }}> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
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

export function Bottone({
  children,
  variante = 'primario',
  type = 'submit',
  name,
  value,
}: {
  children: ReactNode
  variante?: 'primario' | 'secondario'
  type?: 'submit' | 'button'
  name?: string
  value?: string
}) {
  if (variante === 'secondario') {
    return (
      <button
        type={type}
        name={name}
        value={value}
        className="bottone-fantasma rounded-lg border px-4 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--bordo)' }}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      type={type}
      name={name}
      value={value}
      className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold"
      style={{
        background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
        color: '#050a14',
      }}
    >
      {children}
    </button>
  )
}

export function formattaData(data: Date | string | null): string {
  if (!data) return '—'
  // Dai Server Component le Date arrivano al client come stringhe ISO.
  const valore = typeof data === 'string' ? new Date(data) : data
  if (Number.isNaN(valore.getTime())) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(valore)
}

export function formattaEuro(valore: string | null): string {
  if (valore === null) return '—'
  const numero = Number.parseFloat(valore)
  if (Number.isNaN(numero)) return '—'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(numero)
}
