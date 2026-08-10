'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Dialogo } from '@/components/dialogo'
import { BottoneChiama, BottoneWhatsApp } from '@/components/bottoni-contatto'
import { LinkNome } from '@/components/link-nome'
import { Badge, Card, Vuoto, formattaData } from '@/components/ui'
import { componeIndirizzo } from '@/lib/geo/tipi-via'
import type { LeadInElenco, VistaLead } from '@/lib/queries/opportunities'

function normalizza(s: string) {
  return s.trim().toLowerCase()
}

function corrisponde(lead: LeadInElenco, q: string) {
  if (!q) return true
  const pezzi = [
    lead.firstName,
    lead.lastName,
    lead.phone,
    lead.email,
    lead.code,
    lead.title,
    lead.stageLabel,
    lead.proprietario ?? '',
  ]
  const hay = normalizza(pezzi.join(' '))
  return normalizza(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => hay.includes(token))
}

function rigaIndirizzo(lead: LeadInElenco): string | null {
  const via = componeIndirizzo({
    tipoVia: lead.indirizzo.streetType,
    nomeVia: lead.indirizzo.streetName,
    civico: lead.indirizzo.houseNumber,
  })
  const coda = [lead.indirizzo.postalCode, lead.indirizzo.city, lead.indirizzo.province]
    .filter(Boolean)
    .join(' ')
  if (!via && !coda) return null
  return [via, coda].filter(Boolean).join(' · ')
}

export function ElencoLead({
  lead,
  vista = 'aperti',
  puoModificare,
}: {
  lead: readonly LeadInElenco[]
  vista?: VistaLead
  puoModificare: boolean
}) {
  const [ricerca, setRicerca] = useState('')
  const [selezionato, setSelezionato] = useState<LeadInElenco | null>(null)

  const chiudi = useCallback(() => setSelezionato(null), [])

  const filtrati = useMemo(
    () => lead.filter((l) => corrisponde(l, ricerca)),
    [lead, ricerca],
  )

  const attuale =
    selezionato === null ? null : (lead.find((l) => l.id === selezionato.id) ?? selezionato)

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Cerca lead</span>
        <input
          type="search"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca per nome, cognome, telefono, codice…"
          className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]"
          style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          autoComplete="off"
        />
      </label>

      <Card>
        {lead.length === 0 ? (
          <Vuoto
            messaggio={
              vista === 'clienti'
                ? 'Nessun cliente con contratto firmato in elenco.'
                : vista === 'tutti'
                  ? 'Nessun lead. Creane uno con «Nuovo lead».'
                  : 'Nessun lead aperto. Creane uno con «Nuovo lead».'
            }
          />
        ) : filtrati.length === 0 ? (
          <Vuoto messaggio={`Nessun lead corrisponde a «${ricerca.trim()}».`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left text-xs"
                  style={{ borderColor: 'var(--bordo)', color: 'var(--testo-tenue)' }}
                >
                  <th className="pb-2 pr-3 font-medium">Nome</th>
                  <th className="pb-2 pr-3 font-medium">Cognome</th>
                  <th className="pb-2 pr-3 font-medium">Stato</th>
                  <th className="pb-2 pr-3 font-medium">Telefono</th>
                  <th className="pb-2 text-right font-medium">Creato</th>
                </tr>
              </thead>
              <tbody>
                {filtrati.map((l) => (
                  <tr
                    key={l.id}
                    className="riga cursor-pointer border-b last:border-0"
                    style={{ borderColor: 'var(--bordo)' }}
                    onClick={() => setSelezionato(l)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelezionato(l)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Apri ${l.firstName} ${l.lastName}`}
                  >
                    <td
                      className="py-2.5 pr-3 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkNome href={`/lead/${l.id}?vista=${vista}`}>
                        {l.firstName || '—'}
                      </LinkNome>
                    </td>
                    <td
                      className="py-2.5 pr-3 font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkNome href={`/lead/${l.id}?vista=${vista}`}>{l.lastName}</LinkNome>
                    </td>
                    <td className="py-2.5 pr-3">
                      {l.isWon ? (
                        <Badge tone="positivo">Cliente</Badge>
                      ) : l.isLost ? (
                        <Badge tone="critico">{l.stageLabel}</Badge>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
                          {l.stageLabel}
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 pr-3 tabular-nums"
                      style={{ color: 'var(--testo-tenue)' }}
                    >
                      {l.phone || '—'}
                    </td>
                    <td
                      className="py-2.5 text-right tabular-nums"
                      style={{ color: 'var(--testo-tenue)' }}
                    >
                      {formattaData(l.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialogo
        aperto={attuale !== null}
        titolo={
          attuale
            ? [attuale.firstName, attuale.lastName].filter(Boolean).join(' ') ||
              attuale.code
            : ''
        }
        onChiudi={chiudi}
      >
        {attuale ? (
          <DettaglioLead lead={attuale} puoModificare={puoModificare} onNaviga={chiudi} />
        ) : null}
      </Dialogo>
    </div>
  )
}

function DettaglioLead({
  lead,
  puoModificare,
  onNaviga,
}: {
  lead: LeadInElenco
  puoModificare: boolean
  onNaviga: () => void
}) {
  const indirizzo = rigaIndirizzo(lead)

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {lead.isWon ? (
          <Badge tone="positivo">Cliente</Badge>
        ) : (
          <Badge tone={lead.isLost ? 'critico' : 'neutro'}>{lead.stageLabel}</Badge>
        )}
        <span className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
          {lead.code} · {lead.businessLine}
        </span>
        {lead.isOpen && lead.nextActionDueAt === null ? (
          <Badge tone="critico">Senza prossima azione</Badge>
        ) : lead.inRitardo ? (
          <Badge tone="attenzione">Azione scaduta</Badge>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
        <CampoDettaglio etichetta="Nome" valore={lead.firstName || '—'} />
        <CampoDettaglio etichetta="Cognome" valore={lead.lastName} />
        <CampoDettaglio
          etichetta="Telefono"
          valore={
            lead.phone ? (
              <a
                href={`tel:${lead.phoneE164 ?? lead.phone}`}
                className="collega text-eco-blue-300"
              >
                {lead.phone}
              </a>
            ) : (
              '—'
            )
          }
        />
        <CampoDettaglio
          etichetta="Email"
          valore={
            lead.email ? (
              <a href={`mailto:${lead.email}`} className="collega text-eco-blue-300">
                {lead.email}
              </a>
            ) : (
              '—'
            )
          }
        />
        <CampoDettaglio etichetta="Creato" valore={formattaData(lead.createdAt)} />
        <CampoDettaglio etichetta="Responsabile" valore={lead.proprietario || '—'} />
        <CampoDettaglio etichetta="Richiesta" valore={lead.title} largo />
        {indirizzo ? (
          <CampoDettaglio etichetta="Indirizzo" valore={indirizzo} largo />
        ) : null}
        {lead.notes ? (
          <CampoDettaglio etichetta="Note" valore={lead.notes} largo clamp />
        ) : null}
      </dl>

      <div
        className="flex flex-wrap items-center gap-2.5 border-t pt-3"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {lead.phone ? (
          <BottoneChiama telefono={lead.phone} telefonoE164={lead.phoneE164} />
        ) : null}
        {lead.phoneE164 ? <BottoneWhatsApp telefonoE164={lead.phoneE164} /> : null}
        <span className="flex-1" />
        {puoModificare ? (
          <Link
            href={`/lead/${lead.id}/modifica`}
            onClick={onNaviga}
            className="bottone-oro rounded-lg bg-gradient-to-br from-eco-gold-300 to-eco-gold-400 px-4 py-2 text-sm font-semibold text-eco-abisso"
          >
            Modifica
          </Link>
        ) : null}
        <Link
          href={`/lead/${lead.id}`}
          onClick={onNaviga}
          className="bottone-fantasma rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: 'var(--bordo)' }}
        >
          Scheda completa
        </Link>
      </div>
    </div>
  )
}

function CampoDettaglio({
  etichetta,
  valore,
  largo = false,
  clamp = false,
}: {
  etichetta: string
  valore: ReactNode
  largo?: boolean
  clamp?: boolean
}) {
  return (
    <div className={largo ? 'col-span-2' : undefined}>
      <dt
        className="text-[10px] uppercase tracking-[0.08em]"
        style={{ color: 'var(--testo-fioco)' }}
      >
        {etichetta}
      </dt>
      <dd
        className={`mt-0.5 break-words text-sm leading-snug ${clamp ? 'line-clamp-2' : ''}`}
      >
        {valore}
      </dd>
    </div>
  )
}
