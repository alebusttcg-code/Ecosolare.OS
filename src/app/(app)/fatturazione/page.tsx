import { Card, Intestazione } from '@/components/ui'
import { guard } from '@/lib/auth/session'
import { getFattureElenco } from '@/lib/queries/fatture'
import { ElencoFatture } from './elenco'

export const metadata = { title: 'Fatturazione — EcoSolare OS' }

export default async function FatturazionePage() {
  // Sezione riservata ad amministrazione e contabilità: il guard su `update`
  // esclude il commerciale, che sul cantiere vede solo lo stato di incasso, mai
  // gli importi (ADR-006). L'autorizzazione è qui, non solo nel menu.
  await guard('update', 'invoice')

  const fatture = await getFattureElenco()
  const anno = new Date().getFullYear()

  return (
    <div className="space-y-6">
      <Intestazione
        titolo="Fatturazione"
        sottotitolo={
          fatture.length === 0
            ? 'Le fatture nascono da una scadenza del piano pagamenti, nella scheda del cantiere.'
            : `${fatture.length} ${fatture.length === 1 ? 'fattura' : 'fatture'} · cerca, emetti, storna, esporta`
        }
      />

      <Card>
        <ElencoFatture fatture={fatture} />
      </Card>

      <Card title="Esporta registro per il commercialista">
        <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Solo le fatture numerate del periodo, in CSV con separatori e decimali
          all’italiana. Le bozze non entrano nel registro.
        </p>
        <form
          action="/api/fatture/export"
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="block">
            <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Dal
            </span>
            <input
              type="date"
              name="dal"
              defaultValue={`${anno}-01-01`}
              className="w-full rounded-lg border px-3 py-2 text-sm sm:w-44"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Al
            </span>
            <input
              type="date"
              name="al"
              defaultValue={`${anno}-12-31`}
              className="w-full rounded-lg border px-3 py-2 text-sm sm:w-44"
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            />
          </label>
          <button
            type="submit"
            className="bottone-fantasma rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--bordo)' }}
          >
            Scarica CSV
          </button>
        </form>
      </Card>
    </div>
  )
}
