import type { DefinizioneQuestionario, Risposta, Risposte } from '@/lib/domain/questionnaire'

/** Dati già noti dalla scheda lead, da riportare in prequalifica. */
export interface DatiLeadPerPrequalifica {
  readonly addressLine: string | null
  readonly city: string | null
  readonly province: string | null
  readonly postalCode: string | null
  readonly buildingType: string | null
  readonly haAzienda: boolean
}

const CAMPI_INDIRIZZO = [
  {
    code: 'indirizzo',
    label: 'Indirizzo',
    type: 'testo_lungo' as const,
    help: 'Via e civico dalla scheda lead: puoi correggerli qui.',
  },
  {
    code: 'cap',
    label: 'CAP',
    type: 'testo' as const,
  },
  {
    code: 'provincia',
    label: 'Provincia',
    type: 'testo' as const,
  },
] as const

const OPZIONI_EDIFICIO = ['villetta', 'schiera', 'palazzina', 'capannone', 'rurale'] as const

function normalizzaTipoEdificio(raw: string | null): string | null {
  if (!raw?.trim()) return null
  const k = raw.trim().toLowerCase()
  if ((OPZIONI_EDIFICIO as readonly string[]).includes(k)) return k
  if (/villetta|bifamiliare/.test(k)) return 'villetta'
  if (/schiera/.test(k)) return 'schiera'
  if (/palazzina|condominio/.test(k)) return 'palazzina'
  if (/capannone|industriale/.test(k)) return 'capannone'
  if (/rurale|agricol/.test(k)) return 'rurale'
  return null
}

/** Valori di default derivati dalla scheda lead (non ancora salvati in prequalifica). */
export function risposteDaLead(dati: DatiLeadPerPrequalifica): Risposte {
  const out: Record<string, Risposta> = {
    tipo_richiedente: dati.haAzienda ? 'azienda' : 'privato',
  }
  if (dati.addressLine) out.indirizzo = dati.addressLine
  if (dati.city) out.comune = dati.city
  if (dati.postalCode) out.cap = dati.postalCode
  if (dati.province) out.provincia = dati.province
  const edificio = normalizzaTipoEdificio(dati.buildingType)
  if (edificio) out.tipo_edificio = edificio
  return out
}

/** Le risposte salvate hanno priorità sui default del lead. */
export function unisciRispostePrequalifica(daLead: Risposte, salvate: Risposte): Risposte {
  return { ...daLead, ...salvate }
}

/**
 * Aggiunge i campi indirizzo al template attivo se mancano (v1 in database).
 * Evita una migrazione solo per estendere il questionario.
 */
export function arricchisciDefinizionePrequalifica(
  definizione: DefinizioneQuestionario,
): DefinizioneQuestionario {
  return {
    ...definizione,
    sections: definizione.sections.map((sezione) => {
      if (sezione.code !== 'richiedente') return sezione
      if (sezione.fields.some((c) => c.code === 'indirizzo')) return sezione

      const indiceComune = sezione.fields.findIndex((c) => c.code === 'comune')
      const insertAt = indiceComune >= 0 ? indiceComune : sezione.fields.length
      const campi = sezione.fields.map((c) =>
        c.code === 'comune' && !c.help
          ? { ...c, help: 'Comune dalla scheda lead: puoi correggerlo qui.' }
          : c,
      )
      campi.splice(insertAt, 0, ...CAMPI_INDIRIZZO)

      return { ...sezione, fields: campi }
    }),
  }
}
