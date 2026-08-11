import { asc } from 'drizzle-orm'
import { Card, Intestazione, Vuoto, formattaData } from '@/components/ui'
import { getDb } from '@/db'
import { appSettings, pipelineStages } from '@/db/schema'
import { can } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import {
  descriviTipoEvento,
  getCestino,
  getEventiFalliti,
  getPesoCestino,
} from '@/lib/queries/manutenzione'
import { listWorkers } from '@/lib/queries/schedule'
import { ElencoRegoleSistema } from './modifica'
import { PannelloManutenzione } from './manutenzione'
import { GestionePersonale } from './personale'

export const metadata = { title: 'Impostazioni — EcoSolare OS' }

/** Dimensione leggibile: chi legge vuole sapere se sono megabyte o gigabyte. */
function formattaDimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`
  if (byte < 1024 * 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1)} MB`
  return `${(byte / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default async function ImpostazioniPage() {
  const utente = await guard('read', 'settings')

  const db = getDb()
  const [voci, stati, personale] = await Promise.all([
    db.select().from(appSettings).orderBy(asc(appSettings.key)),
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder)),
    listWorkers(),
  ])
  const puoScriverePersonale = can(utente, 'update', 'settings')

  const [eventiFalliti, cestino, pesoCestino] = [
    await getEventiFalliti(),
    await getCestino(),
    await getPesoCestino(),
  ]

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

      <Card id="manutenzione" title="Manutenzione e cestino" accento="oro" indice={1}>
        <PannelloManutenzione
          eventi={eventiFalliti.map((e) => ({
            id: e.id,
            descrizione: descriviTipoEvento(e.tipo),
            tentativi: e.tentativi,
            errore: e.errore,
            creatoIl: formattaData(e.creatoIl),
          }))}
          cestino={cestino.map((c) => ({
            id: c.id,
            genere: c.genere,
            nome: c.nome,
            contesto: c.contesto,
            eliminatoIl: formattaData(c.eliminatoIl),
            eliminatoDa: c.eliminatoDa,
            dimensione: formattaDimensione(c.dimensione),
          }))}
          pesoCestino={formattaDimensione(pesoCestino)}
        />
      </Card>

      <Card id="regole" title="Regole di sistema" accento="blu" indice={2}>
        {voci.length === 0 ? (
          <Vuoto messaggio="Nessuna configurazione. Eseguire npm run db:seed." />
        ) : (
          <>
            <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
              Soglie operative usate da lead, pipeline e preventivi. I titoli sono in
              italiano; la chiave tecnica resta sotto per riferimento.
            </p>
            <ElencoRegoleSistema
              voci={voci.map((voce) => ({
                key: voce.key,
                value: voce.value,
                description: voce.description,
              }))}
            />
          </>
        )}
      </Card>

      <Card title="Stati della pipeline" indice={3}>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--testo-tenue)' }}>
          Ordine degli stati commerciali. Oggi in sola lettura: le modifiche passano
          dalla tabella <code className="text-xs">pipeline_stages</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-[11px] font-semibold tracking-wide uppercase"
                style={{ borderColor: 'var(--bordo-tenue)', color: 'var(--testo-fioco)' }}
              >
                <th className="pb-2.5 font-semibold">Stato</th>
                <th className="pb-2.5 font-semibold">Codice</th>
                <th className="pb-2.5 font-semibold">Tipo</th>
                <th className="pb-2.5 text-right font-semibold">Prob.</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bordo-tenue)' }}>
              {stati.map((s) => (
                <tr key={s.code} className="riga">
                  <td className="py-2.5 font-medium">{s.label}</td>
                  <td className="py-2.5 font-mono text-xs" style={{ color: 'var(--testo-fioco)' }}>
                    {s.code}
                  </td>
                  <td className="py-2.5 text-xs" style={{ color: 'var(--testo-tenue)' }}>
                    {s.isWon ? 'vinto' : s.isLost ? 'perso' : s.isOpen ? 'aperto' : 'chiuso'}
                    {!s.isActive ? ' · disattivato' : ''}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{s.defaultProbability}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
