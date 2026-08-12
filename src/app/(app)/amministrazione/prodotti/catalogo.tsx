'use client'

import { useMemo, useRef, useState } from 'react'
import { Badge, Card, Vuoto, formattaData } from '@/components/ui'
import { aggiornaDatiTecniciProdotto } from '@/lib/actions/catalogo'
import {
  caricaSchedaTecnica,
  ripristinaSchedaTecnica,
  ritiraSchedaTecnica,
} from '@/lib/actions/schede-tecniche'
import { scriviSelezionePagine } from '@/lib/domain/selezione-pagine'
import type { ProdottoConSchede, SchedaProdotto } from '@/lib/queries/documenti-tecnici'
import { useAzioneServer } from '@/lib/use-azione-server'

const CATEGORIE: readonly { value: SchedaProdotto['category']; label: string }[] = [
  { value: 'scheda_tecnica', label: 'Scheda tecnica' },
  { value: 'certificazione', label: 'Certificazione' },
  { value: 'garanzia', label: 'Garanzia' },
  { value: 'manuale', label: 'Manuale' },
]

const ETICHETTA_CATEGORIA: Record<SchedaProdotto['category'], string> = {
  scheda_tecnica: 'Scheda tecnica',
  certificazione: 'Certificazione',
  garanzia: 'Garanzia',
  manuale: 'Manuale',
}

export function CatalogoSchede({ catalogo }: { catalogo: readonly ProdottoConSchede[] }) {
  const [filtro, setFiltro] = useState('')
  const [soloSenzaScheda, setSoloSenzaScheda] = useState(false)

  const visibili = useMemo(() => {
    const cercato = filtro.trim().toLowerCase()
    return catalogo.filter((prodotto) => {
      if (soloSenzaScheda && prodotto.schede.some((scheda) => scheda.isActive)) return false
      if (cercato === '') return true
      return [prodotto.name, prodotto.code, prodotto.brand, prodotto.model]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(cercato))
    })
  }, [catalogo, filtro, soloSenzaScheda])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Cerca per nome, codice, marca…"
          className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
          style={{ background: 'rgba(5,10,20,0.6)', borderColor: 'var(--bordo)' }}
        />
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--testo-fioco)' }}>
          <input
            type="checkbox"
            checked={soloSenzaScheda}
            onChange={(e) => setSoloSenzaScheda(e.target.checked)}
          />
          Solo prodotti senza scheda
        </label>
      </div>

      {visibili.length === 0 ? (
        <Vuoto messaggio="Nessun prodotto corrisponde." />
      ) : (
        <div className="space-y-3">
          {visibili.map((prodotto, indice) => (
            <RigaProdotto key={prodotto.id} prodotto={prodotto} indice={indice} />
          ))}
        </div>
      )}
    </div>
  )
}

function RigaProdotto({
  prodotto,
  indice,
}: {
  prodotto: ProdottoConSchede
  indice: number
}) {
  const [aperto, setAperto] = useState(false)
  const attive = prodotto.schede.filter((scheda) => scheda.isActive)
  const ritirate = prodotto.schede.filter((scheda) => !scheda.isActive)

  return (
    <Card indice={indice}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{prodotto.name}</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
            {prodotto.code}
            {prodotto.brand ? ` · ${prodotto.brand}` : ''}
            {prodotto.model ? ` ${prodotto.model}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prodotto.componentRole ? null : <Badge tone="attenzione">senza ruolo</Badge>}
          {attive.length === 0 ? (
            <Badge tone="neutro">nessun allegato</Badge>
          ) : (
            <Badge tone="positivo">
              {attive.length} {attive.length === 1 ? 'allegato' : 'allegati'}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setAperto((precedente) => !precedente)}
            className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--bordo)' }}
          >
            {aperto ? 'Chiudi' : 'Gestisci'}
          </button>
        </div>
      </div>

      {aperto ? (
        <div className="mt-4 space-y-5 border-t pt-4" style={{ borderColor: 'var(--bordo-tenue)' }}>
          <DatiTecnici prodotto={prodotto} />

          <div className="border-t pt-4" style={{ borderColor: 'var(--bordo-tenue)' }}>
            <h3 className="mb-3 text-xs font-semibold tracking-wide" style={{ color: 'var(--testo-fioco)' }}>
              DOCUMENTI DA ALLEGARE AL PREVENTIVO
            </h3>
          {prodotto.schede.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--testo-fioco)' }}>
              Nessun documento caricato: i preventivi che contengono questo prodotto escono senza
              pagine tecniche.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...attive, ...ritirate].map((scheda) => (
                <RigaScheda key={scheda.id} scheda={scheda} />
              ))}
            </ul>
          )}

            <div className="mt-4">
              <ModuloCaricamento productId={prodotto.id} prodotto={prodotto.name} />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

const RUOLI: readonly { value: string; label: string }[] = [
  { value: '', label: 'Non classificato' },
  { value: 'modulo', label: 'Modulo fotovoltaico' },
  { value: 'inverter', label: 'Inverter' },
  { value: 'accumulo', label: 'Accumulo' },
  { value: 'pompa_calore', label: 'Pompa di calore' },
  { value: 'struttura', label: 'Struttura' },
  { value: 'quadro', label: 'Quadro elettrico' },
  { value: 'altro', label: 'Altro' },
]

/**
 * I dati tecnici del prodotto.
 *
 * Sono ciò che rende il preventivo calcolato invece che raccontato: la
 * capacità dell'accumulo qui dentro decide il risparmio stampato sul PDF.
 * Finché restano vuoti il sistema ripiega sulla descrizione — «Batteria di
 * accumulo 10 kWh» letta con un'espressione regolare — e basta che qualcuno
 * scriva la riga diversamente perché l'accumulo sparisca dai calcoli senza
 * che niente lo dica.
 *
 * I campi compaiono in base al ruolo: a un modulo non si chiede lo SCOP.
 */
function DatiTecnici({ prodotto }: { prodotto: ProdottoConSchede }) {
  const [ruolo, setRuolo] = useState(prodotto.componentRole ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [salvato, setSalvato] = useState(false)
  const { inCorso, esegui } = useAzioneServer()

  function invia(formData: FormData) {
    setErrors({})
    setSalvato(false)
    esegui(async () => {
      const esito = await aggiornaDatiTecniciProdotto(formData)
      if (esito.ok) setSalvato(true)
      else setErrors(esito.errors)
    })
  }

  return (
    <form action={invia} className="space-y-3">
      <input type="hidden" name="productId" value={prodotto.id} />
      <h3
        className="text-xs font-semibold tracking-wide"
        style={{ color: 'var(--testo-fioco)' }}
      >
        DATI TECNICI — ENTRANO NEI CALCOLI DEL PREVENTIVO
      </h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Ruolo nell’impianto</span>
          <select
            name="componentRole"
            value={ruolo}
            onChange={(e) => setRuolo(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'rgba(5,10,20,0.6)', borderColor: 'var(--bordo)' }}
          >
            {RUOLI.map((voce) => (
              <option key={voce.value} value={voce.value}>
                {voce.label}
              </option>
            ))}
          </select>
        </label>
        <CampoTesto label="Marca" name="brand" defaultValue={prodotto.brand ?? ''} errore={errors.brand} />
        <CampoTesto label="Modello" name="model" defaultValue={prodotto.model ?? ''} errore={errors.model} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ruolo === 'modulo' ? (
          <CampoTesto
            label="Potenza di picco (Wp)"
            name="ratedPowerW"
            defaultValue={prodotto.ratedPowerW != null ? String(prodotto.ratedPowerW) : ''}
            errore={errors.ratedPowerW}
          />
        ) : null}
        {ruolo === 'inverter' ? (
          <CampoTesto
            label="Potenza CA (kW)"
            name="acPowerKw"
            defaultValue={prodotto.acPowerKw ?? ''}
            errore={errors.acPowerKw}
          />
        ) : null}
        {ruolo === 'accumulo' ? (
          <CampoTesto
            label="Capacità (kWh)"
            name="capacityKwh"
            defaultValue={prodotto.capacityKwh ?? ''}
            errore={errors.capacityKwh}
          />
        ) : null}
        {ruolo === 'pompa_calore' ? (
          <CampoTesto
            label="SCOP"
            name="scop"
            defaultValue={prodotto.scop ?? ''}
            errore={errors.scop}
          />
        ) : null}
      </div>

      {ruolo === 'pompa_calore' ? (
        <p className="text-[11px]" style={{ color: 'var(--testo-fioco)' }}>
          Senza SCOP il risparmio sul riscaldamento non entra nel piano economico:
          la pompa di calore resta una voce di spesa e il rientro esce peggiore
          del vero.
        </p>
      ) : null}

      {errors._ ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errors._}
        </p>
      ) : null}
      {salvato ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-green-400)' }}>
          Salvato. I preventivi nuovi useranno questi valori.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={inCorso}
        className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
        style={{ borderColor: 'var(--bordo)' }}
      >
        {inCorso ? 'Salvataggio…' : 'Salva dati tecnici'}
      </button>
    </form>
  )
}

function RigaScheda({ scheda }: { scheda: SchedaProdotto }) {
  const { inCorso, esegui } = useAzioneServer()
  const [errore, setErrore] = useState<string | null>(null)

  function cambiaStato() {
    setErrore(null)
    esegui(async () => {
      const esito = scheda.isActive
        ? await ritiraSchedaTecnica(scheda.id)
        : await ripristinaSchedaTecnica(scheda.id)
      if (!esito.ok) setErrore(esito.errors._ ?? 'Operazione non riuscita.')
    })
  }

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
      style={{
        borderColor: 'var(--bordo-tenue)',
        opacity: scheda.isActive ? 1 : 0.55,
      }}
    >
      <div className="min-w-0">
        <p className="text-sm">
          {scheda.title}{' '}
          <span style={{ color: 'var(--testo-fioco)' }}>({scheda.versionLabel})</span>
        </p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--testo-fioco)' }}>
          {ETICHETTA_CATEGORIA[scheda.category]} · {scheda.filename} ·{' '}
          {scheda.includedPages
            ? `pagine ${scriviSelezionePagine(scheda.includedPages)}`
            : 'tutte le pagine'}{' '}
          · caricata il {formattaData(scheda.createdAt)}
        </p>
        {errore ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
            {errore}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {scheda.isActive ? null : <Badge tone="attenzione">ritirata</Badge>}
        <button
          type="button"
          onClick={cambiaStato}
          disabled={inCorso}
          className="bottone-fantasma rounded-lg border px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--bordo)' }}
        >
          {inCorso ? '…' : scheda.isActive ? 'Ritira' : 'Ripristina'}
        </button>
      </div>
    </li>
  )
}

/**
 * Il modulo di caricamento.
 *
 * Il titolo si precompila con il nome del prodotto perché è quello che finisce
 * stampato sopra la pagina tecnica nel preventivo: lasciarlo vuoto invita a
 * scriverci «scheda.pdf».
 */
function ModuloCaricamento({
  productId,
  prodotto,
}: {
  productId: string
  prodotto: string
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [esito, setEsito] = useState<string | null>(null)
  const { inCorso, esegui } = useAzioneServer()
  const form = useRef<HTMLFormElement>(null)

  function invia(formData: FormData) {
    setErrors({})
    setEsito(null)
    esegui(async () => {
      const risposta = await caricaSchedaTecnica(formData)
      if (risposta.ok) {
        setEsito(
          `Caricata: ${risposta.data.pagine} ${risposta.data.pagine === 1 ? 'pagina' : 'pagine'} finiranno in coda al preventivo.`,
        )
        form.current?.reset()
      } else {
        setErrors(risposta.errors)
      }
    })
  }

  return (
    <form ref={form} action={invia} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTesto
          label="Titolo"
          name="title"
          defaultValue={prodotto}
          errore={errors.title}
          required
        />
        <CampoTesto
          label="Revisione"
          name="versionLabel"
          placeholder="rev. 2026-03"
          errore={errors.versionLabel}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Tipo</span>
          <select
            name="category"
            defaultValue="scheda_tecnica"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ background: 'rgba(5,10,20,0.6)', borderColor: 'var(--bordo)' }}
          >
            {CATEGORIE.map((categoria) => (
              <option key={categoria.value} value={categoria.value}>
                {categoria.label}
              </option>
            ))}
          </select>
        </label>
        <CampoTesto
          label="Pagine"
          name="includedPages"
          placeholder="tutte — oppure 1,3 o 2-4"
          errore={errors.includedPages}
        />
        <CampoTesto label="Ordine" name="sortOrder" defaultValue="0" errore={errors.sortOrder} />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">
          File PDF<span style={{ color: 'var(--color-eco-gold-400)' }}> *</span>
        </span>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="w-full text-sm"
        />
        {errors.file ? (
          <span className="mt-1 block text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
            {errors.file}
          </span>
        ) : null}
      </label>

      {errors._ ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-red-400)' }}>
          {errors._}
        </p>
      ) : null}
      {esito ? (
        <p className="text-xs" style={{ color: 'var(--color-eco-green-400)' }}>
          {esito}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={inCorso}
        className="bottone-oro rounded-lg px-4 py-2 text-sm font-semibold"
        style={{
          background: 'linear-gradient(135deg, #e8c765 0%, #d9a441 100%)',
          color: '#050a14',
        }}
      >
        {inCorso ? 'Caricamento…' : 'Carica documento'}
      </button>
    </form>
  )
}

function CampoTesto({
  label,
  name,
  defaultValue,
  placeholder,
  errore,
  required,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  errore?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span style={{ color: 'var(--color-eco-gold-400)' }}> *</span> : null}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-eco-blue-400"
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
