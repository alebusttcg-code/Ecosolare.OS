import { asc } from 'drizzle-orm'
import { Card, Intestazione, Vuoto } from '@/components/ui'
import { getDb } from '@/db'
import { appSettings, pipelineStages } from '@/db/schema'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { listWorkers } from '@/lib/queries/schedule'
import { ModificaConfigurazione } from './modifica'
import { GestionePersonale } from './personale'

export const metadata = { title: 'Impostazioni — EcoSolare OS' }

export default async function ImpostazioniPage() {
  const utente = await guard('read', 'settings')

  const db = getDb()
  const [voci, stati, personale] = await Promise.all([
    db.select().from(appSettings).orderBy(asc(appSettings.key)),
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder)),
    listWorkers(),
  ])
  const puoScriverePersonale = can(utente, 'update', 'settings')

  return (
    <div className="space-y-8">
      <Intestazione
        eyebrow="Amministrazione"
        titolo="Impostazioni"
        sottotitolo="Squadra cantiere, soglie e regole — senza rilascio."
      />

      <Card id="personale" title="Squadra cantiere" accento="oro" indice={0}>
        <GestionePersonale
          personale={personale}
          puoScrivere={puoScriverePersonale}
        />
      </Card>

      <div className="space-y-3">
        <div className="px-0.5">
          <h2 className="text-sm font-semibold tracking-tight">Regole di sistema</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            Soglie e parametri in JSON — distinti dalla squadra sopra.
          </p>
        </div>
        {voci.length === 0 ? (
          <Card>
            <Vuoto messaggio="Nessuna configurazione. Eseguire npm run db:seed." />
          </Card>
        ) : (
          voci.map((voce) => (
            <ModificaConfigurazione
              key={voce.key}
              voce={{ key: voce.key, value: voce.value, description: voce.description }}
            />
          ))
        )}
      </div>

      <Card title="Stati della pipeline">
        <p className="mb-4 text-xs" style={{ color: 'var(--testo-tenue)' }}>
          Gli stati vivono nel database e non nel codice: dopo l&apos;audit si potranno
          aggiungere o rinominare senza un rilascio. La modifica da interfaccia arriva con
          la Fase 2; oggi si interviene sulla tabella <code>pipeline_stages</code>.
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b text-left text-xs"
              style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
            >
              <th className="pb-2 font-medium">Stato</th>
              <th className="pb-2 font-medium">Codice</th>
              <th className="pb-2 font-medium">Tipo</th>
              <th className="pb-2 text-right font-medium">Probabilità</th>
            </tr>
          </thead>
          <tbody>
            {stati.map((s) => (
              <tr key={s.code} className="riga border-b last:border-0" style={{ borderColor: 'var(--bordo)' }}>
                <td className="py-2">{s.label}</td>
                <td className="py-2 font-mono text-xs" style={{ color: 'var(--testo-tenue)' }}>
                  {s.code}
                </td>
                <td className="py-2" style={{ color: 'var(--testo-tenue)' }}>
                  {s.isWon ? 'vinto' : s.isLost ? 'perso' : s.isOpen ? 'aperto' : 'chiuso'}
                  {!s.isActive ? ' · disattivato' : ''}
                </td>
                <td className="py-2 text-right tabular-nums">{s.defaultProbability}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}
