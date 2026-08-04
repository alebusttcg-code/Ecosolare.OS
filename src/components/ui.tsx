import type { ReactNode } from 'react'

/**
 * Primitive di interfaccia.
 *
 * Non e' un design system: sono i pochi elementi che si ripetono ovunque,
 * raccolti per non riscrivere le stesse classi in venti file. §13 del brief:
 * interfaccia operativa, non decorativa.
 */

export function Card({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className="rounded-lg border"
      style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
    >
      {title ? (
        <header
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--bordo)' }}
        >
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutro',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutro' | 'attenzione' | 'critico'
}) {
  const colore =
    tone === 'critico' ? '#b42318' : tone === 'attenzione' ? '#b54708' : 'inherit'

  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ background: 'var(--superficie)', borderColor: 'var(--bordo)' }}
    >
      <div className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: colore }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
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
  tone?: 'neutro' | 'positivo' | 'attenzione' | 'critico'
}) {
  const stili: Record<string, { bg: string; fg: string }> = {
    neutro: { bg: 'var(--sfondo)', fg: 'var(--testo-tenue)' },
    positivo: { bg: '#e7f4e4', fg: '#2b6a25' },
    attenzione: { bg: '#fdf3d4', fg: '#8a6100' },
    critico: { bg: '#fdecea', fg: '#b42318' },
  }
  const s = stili[tone] ?? stili.neutro!

  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  )
}

export function Vuoto({ messaggio }: { messaggio: string }) {
  return (
    <p className="py-8 text-center text-sm" style={{ color: 'var(--testo-tenue)' }}>
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
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-md border px-3 py-2 text-sm"
        style={{
          background: 'var(--superficie)',
          borderColor: errore ? '#d92d20' : 'var(--bordo)',
        }}
      />
      {errore ? <span className="mt-1 block text-xs text-red-600">{errore}</span> : null}
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
  const classi =
    variante === 'primario'
      ? 'bg-eco-blue-500 text-white hover:bg-eco-blue-600'
      : 'border hover:opacity-80'

  return (
    <button
      type={type}
      name={name}
      value={value}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${classi}`}
      style={variante === 'secondario' ? { borderColor: 'var(--bordo)' } : undefined}
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
