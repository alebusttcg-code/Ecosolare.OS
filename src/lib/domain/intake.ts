import { z } from 'zod'
import { normalizeEmail, normalizePhone } from './phone'

/**
 * Interpretazione dei payload di intake.
 *
 * I form del sito, le landing e gli strumenti di terze parti chiamano i campi
 * in modi diversi ("nome", "name", "first_name", "firstname"). Normalizzare qui
 * i nomi dei campi evita di dover riconfigurare ogni form perche' parli la
 * lingua del gestionale: e' il gestionale che si adatta.
 *
 * Funzione pura: nessun accesso al database, interamente testabile.
 */

const CAMPI = {
  nome: ['nome', 'name', 'first_name', 'firstname', 'firstName'],
  cognome: ['cognome', 'surname', 'last_name', 'lastname', 'lastName'],
  nomeCompleto: ['nome_completo', 'full_name', 'fullname', 'fullName', 'nominativo'],
  email: ['email', 'e-mail', 'mail', 'indirizzo_email'],
  telefono: ['telefono', 'phone', 'tel', 'cellulare', 'mobile', 'numero'],
  messaggio: ['messaggio', 'message', 'note', 'notes', 'richiesta', 'descrizione'],
  comune: ['comune', 'citta', 'city', 'localita'],
  indirizzo: ['indirizzo', 'address', 'via'],
  lineaBusiness: ['linea', 'servizio', 'service', 'tipo_intervento'],
  fonte: ['fonte', 'source', 'origine'],
  idEsterno: ['id', 'external_id', 'submission_id', 'entry_id', 'lead_id'],
} as const

function primoValore(raw: Record<string, unknown>, chiavi: readonly string[]): string | null {
  for (const chiave of chiavi) {
    const valore = raw[chiave]
    if (typeof valore === 'string' && valore.trim() !== '') return valore.trim()
    if (typeof valore === 'number') return String(valore)
  }
  return null
}

export type LineaBusiness = 'fotovoltaico' | 'elettrico' | 'idraulico'

export interface LeadNormalizzato {
  readonly firstName: string | null
  readonly lastName: string
  readonly email: string | null
  readonly emailNormalized: string | null
  readonly phone: string | null
  readonly phoneE164: string | null
  readonly city: string | null
  readonly addressLine: string | null
  readonly message: string | null
  readonly businessLine: LineaBusiness
  readonly sourceCode: string | null
  readonly externalId: string | null
}

export type EsitoParsing =
  | { readonly ok: true; readonly lead: LeadNormalizzato }
  | { readonly ok: false; readonly motivo: string }

/** Riconosce la linea di business dal testo, con il fotovoltaico come default. */
function riconosciLinea(valore: string | null, messaggio: string | null): LineaBusiness {
  const testo = `${valore ?? ''} ${messaggio ?? ''}`.toLowerCase()
  if (/idraulic|caldaia|termo|pompa di calore|bagno/.test(testo)) return 'idraulico'
  if (/elettric|quadro|impianto elettrico|colonnina|presa/.test(testo)) return 'elettrico'
  // Il core business e' il fotovoltaico (§1 del brief): in assenza di indizi
  // e' l'ipotesi piu' probabile, e comunque correggibile dal commerciale.
  return 'fotovoltaico'
}

/**
 * Estrae il cognome. Se arriva solo un nome completo, si prende l'ultima parola
 * come cognome: e' una convenzione imperfetta ma esplicita, e il commerciale
 * puo' correggerla. Meglio di scartare il lead.
 */
function estraiNomi(raw: Record<string, unknown>): { nome: string | null; cognome: string | null } {
  const nome = primoValore(raw, CAMPI.nome)
  const cognome = primoValore(raw, CAMPI.cognome)
  if (cognome) return { nome, cognome }

  const completo = primoValore(raw, CAMPI.nomeCompleto) ?? nome
  if (!completo) return { nome: null, cognome: null }

  const parti = completo.split(/\s+/)
  if (parti.length === 1) return { nome: null, cognome: parti[0] ?? null }
  return { nome: parti.slice(0, -1).join(' '), cognome: parti.at(-1) ?? null }
}

export function parseIntakePayload(payload: unknown): EsitoParsing {
  const oggetto = z.record(z.string(), z.unknown()).safeParse(payload)
  if (!oggetto.success) return { ok: false, motivo: 'Il corpo della richiesta non e un oggetto.' }

  const raw = oggetto.data
  const { nome, cognome } = estraiNomi(raw)
  const email = primoValore(raw, CAMPI.email)
  const telefono = primoValore(raw, CAMPI.telefono)

  if (!cognome) {
    return { ok: false, motivo: 'Manca il nominativo: impossibile creare un contatto.' }
  }

  const emailNormalizzata = normalizeEmail(email)
  const telefonoNormalizzato = normalizePhone(telefono)

  // Senza un recapito il lead non e' contattabile, quindi non e' un lead.
  if (!emailNormalizzata && !telefonoNormalizzato.e164) {
    return { ok: false, motivo: 'Manca un recapito valido (email o telefono).' }
  }

  const messaggio = primoValore(raw, CAMPI.messaggio)

  return {
    ok: true,
    lead: {
      firstName: nome,
      lastName: cognome,
      email,
      emailNormalized: emailNormalizzata,
      phone: telefonoNormalizzato.raw || null,
      phoneE164: telefonoNormalizzato.e164,
      city: primoValore(raw, CAMPI.comune),
      addressLine: primoValore(raw, CAMPI.indirizzo),
      message: messaggio,
      businessLine: riconosciLinea(primoValore(raw, CAMPI.lineaBusiness), messaggio),
      sourceCode: primoValore(raw, CAMPI.fonte),
      externalId: primoValore(raw, CAMPI.idEsterno),
    },
  }
}

/**
 * Soglia oltre la quale la nuova richiesta viene collegata a un contatto
 * esistente invece di creare un'anagrafica nuova.
 *
 * Non e' una fusione automatica (che resta vietata, US-02.2): due record
 * esistenti non vengono mai uniti. Qui si riconosce che un identificativo
 * forte — telefono, email o codice fiscale IDENTICI — appartiene a una persona
 * gia' in archivio. Il punteggio 95 e' raggiungibile solo per corrispondenza
 * esatta di uno di questi, mai per somiglianza di nome.
 */
export const SOGLIA_COLLEGAMENTO = 95
