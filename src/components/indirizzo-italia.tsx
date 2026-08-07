'use client'

import { useMemo, useState } from 'react'
import {
  capDelComune,
  elencoComuni,
  elencoProvince,
  elencoRegioni,
  regioneDiProvincia,
  TIPI_VIA,
} from '@/lib/geo/italia'
import type { IndirizzoIniziale } from '@/lib/geo/tipi-via'

export type { IndirizzoIniziale }

const SELECT =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400 focus:shadow-[0_0_0_3px_rgba(91,155,213,0.14)]'

/**
 * Indirizzo italiano a pezzi, con regione → provincia → comune a cascata.
 *
 * I campi finiscono nel FormData con i name qui sotto; il server li ricompone
 * in `address_line` + provincia/CAP/comune sulla tabella siti.
 */
export function IndirizzoItalia({
  errori = {},
  iniziale,
}: {
  errori?: Record<string, string>
  iniziale?: IndirizzoIniziale
}) {
  const regioni = useMemo(() => elencoRegioni(), [])
  const provinciaIniziale = iniziale?.province?.toUpperCase() ?? ''
  const [regione, setRegione] = useState(
    () => (provinciaIniziale ? regioneDiProvincia(provinciaIniziale) ?? '' : ''),
  )
  const [provincia, setProvincia] = useState(provinciaIniziale)
  const [comune, setComune] = useState(iniziale?.city ?? '')
  const [cap, setCap] = useState(iniziale?.postalCode ?? '')

  const province = useMemo(() => elencoProvince(regione || undefined), [regione])
  const comuni = useMemo(() => elencoComuni(provincia || undefined), [provincia])
  const comuneScelto = comuni.find((c) => c.n === comune)
  const caps = comuneScelto ? capDelComune(comuneScelto) : []

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium">Indirizzo dell’intervento</legend>
      <p className="text-xs" style={{ color: 'var(--testo-tenue)' }}>
        Facoltativo: si completa quando si conosce il sito.
      </p>

      <div className="grid gap-3 md:grid-cols-[8rem_1fr_5.5rem]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tipo</span>
          <select
            name="streetType"
            className={SELECT}
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            defaultValue={iniziale?.streetType ?? ''}
          >
            <option value="">—</option>
            {TIPI_VIA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome della via</span>
          <input
            name="streetName"
            defaultValue={iniziale?.streetName ?? ''}
            className={SELECT}
            style={{
              background: 'rgba(5,10,20,0.55)',
              borderColor: errori.streetName ? 'var(--color-eco-red-400)' : 'var(--bordo)',
            }}
            placeholder="Roma"
          />
          {errori.streetName ? (
            <span className="mt-1 block text-xs text-eco-red-400">{errori.streetName}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Civico</span>
          <input
            name="houseNumber"
            defaultValue={iniziale?.houseNumber ?? ''}
            className={SELECT}
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            placeholder="12"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Regione</span>
          <select
            name="region"
            value={regione}
            onChange={(e) => {
              setRegione(e.target.value)
              setProvincia('')
              setComune('')
              setCap('')
            }}
            className={SELECT}
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          >
            <option value="">Seleziona…</option>
            {regioni.map((r) => (
              <option key={r.codice} value={r.codice}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Provincia</span>
          <select
            name="province"
            value={provincia}
            disabled={!regione}
            onChange={(e) => {
              setProvincia(e.target.value)
              setComune('')
              setCap('')
            }}
            className={SELECT}
            style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
          >
            <option value="">{regione ? 'Seleziona…' : 'Prima la regione'}</option>
            {province.map((p) => (
              <option key={p.sigla} value={p.sigla}>
                {p.nome} ({p.sigla})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Comune</span>
          <select
            name="city"
            value={comune}
            disabled={!provincia}
            onChange={(e) => {
              const nome = e.target.value
              setComune(nome)
              const trovato = comuni.find((c) => c.n === nome)
              const elenco = trovato ? capDelComune(trovato) : []
              setCap(elenco.length === 1 ? elenco[0]! : '')
            }}
            className={SELECT}
            style={{
              background: 'rgba(5,10,20,0.55)',
              borderColor: errori.city ? 'var(--color-eco-red-400)' : 'var(--bordo)',
            }}
          >
            <option value="">{provincia ? 'Seleziona…' : 'Prima la provincia'}</option>
            {comuni.map((c) => (
              <option key={`${c.s}-${c.n}`} value={c.n}>
                {c.n}
              </option>
            ))}
          </select>
          {errori.city ? (
            <span className="mt-1 block text-xs text-eco-red-400">{errori.city}</span>
          ) : null}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">CAP</span>
          {caps.length > 1 ? (
            <select
              name="postalCode"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className={SELECT}
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
            >
              <option value="">Seleziona…</option>
              {caps.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="postalCode"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              maxLength={5}
              inputMode="numeric"
              className={SELECT}
              style={{ background: 'rgba(5,10,20,0.55)', borderColor: 'var(--bordo)' }}
              placeholder="00000"
            />
          )}
        </label>
      </div>
    </fieldset>
  )
}
