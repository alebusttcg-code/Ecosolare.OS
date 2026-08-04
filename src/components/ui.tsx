import type { ReactNode } from 'react'

/**
 * Primitive di interfaccia, allineate al linguaggio visivo della presentazione:
 * pannelli traslucidi, filetti sottili, oro come accento, verde solo per gli
 * esiti positivi.
 */

export function Intestazione({
  eyebrow,
  titolo,
  sottotitolo,
  azione,
}: {
  eyebrow?: string
  titolo: string
  sottotitolo?: string
  azione?: ReactNode
}) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1.5 eyebrow">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold tracking-tight">{titolo}</h1>
          {sottotitolo ? (
            <p className="mt-1.5 text-sm" style={{ color: 'var(--testo-tenue)' }}>
              {sottotitolo}
            </p>
          ) : null}
        </div>
        {azione ? <div className="shrink-0">{azione}</div> : null}
      </div>
      <div className="mt-4 filetto" />
    </div>
  )
}

export function Card({
  title,
  action,
  accento = 'neutro',
  children,
}: {
  title?: string
  action?: ReactNode
  accento?: 'neutro' | 'blu' | 'oro' | 'verde' | 'rosso'
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
    <section className="pannello" style={{ borderColor: bordi[accento] }}>
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
  hint,
  tone = 'neutro',
  icona,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutro' | 'positivo' | 'attenzione' | 'critico'
  icona?: string
}) {
  const colori: Record<string, string> = {
    neutro: 'var(--color-eco-blue-300)',
    positivo: 'var(--color-eco-green-400)',
    attenzione: 'var(--color-eco-gold-300)',
    critico: 'var(--color-eco-red-400)',
  }
  const colore = colori[tone] ?? colori.neutro!

  return (
    <div className="pannello px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
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
        className="mt-2 text-3xl font-semibold tabular-nums tracking-tight"
        style={{ color: tone === 'neutro' ? 'var(--testo)' : colore }}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          {hint}
        </div>
      ) : null}
    </div>
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
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
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
        className="w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:border-eco-blue-500"
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
        className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
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
      className="rounded-lg px-4 py-2 text-sm font-semibold text-eco-abisso transition-opacity hover:opacity-90"
      style={{
        background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
      }}
    >
      {children}
    </button>
  )
}

export function formattaData(data: Date | null): string {
  if (!data) return '—'
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(data)
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
