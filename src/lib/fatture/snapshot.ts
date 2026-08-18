/**
 * Lo snapshot fiscale del cliente, congelato sulla fattura.
 *
 * Una fattura deve restare fedele a com'era il cliente il giorno dell'emissione,
 * anche se l'anagrafica cambia dopo. Qui si compone lo snapshot da anagrafica —
 * dall'azienda se il cliente è B2B, dalla persona se è un privato.
 *
 * **Limite noto:** i contatti privati oggi non hanno un indirizzo di
 * fatturazione in anagrafica (solo le aziende). Per un privato l'indirizzo resta
 * `null` finché non lo si aggiunge al contatto o non lo si prende dal sito: la
 * validazione all'emissione lo segnala, così non esce una fattura monca.
 */

export interface SnapshotCliente {
  readonly tipo: 'persona' | 'azienda'
  readonly denominazione: string
  readonly codiceFiscale: string | null
  readonly partitaIva: string | null
  readonly indirizzo: string | null
  readonly citta: string | null
  readonly provincia: string | null
  readonly cap: string | null
  readonly pec: string | null
  readonly codiceDestinatario: string | null
}

export interface ContattoFiscale {
  readonly firstName: string | null
  readonly lastName: string
  readonly taxCode: string | null
}

export interface AziendaFiscale {
  readonly legalName: string
  readonly vatNumber: string | null
  readonly taxCode: string | null
  readonly pec: string | null
  readonly sdiCode: string | null
  readonly addressLine: string | null
  readonly city: string | null
  readonly province: string | null
  readonly postalCode: string | null
}

export function componiSnapshotCliente(
  contatto: ContattoFiscale,
  azienda: AziendaFiscale | null,
): SnapshotCliente {
  if (azienda) {
    return {
      tipo: 'azienda',
      denominazione: azienda.legalName,
      codiceFiscale: azienda.taxCode,
      partitaIva: azienda.vatNumber,
      indirizzo: azienda.addressLine,
      citta: azienda.city,
      provincia: azienda.province,
      cap: azienda.postalCode,
      pec: azienda.pec,
      codiceDestinatario: azienda.sdiCode,
    }
  }

  const denominazione = [contatto.firstName, contatto.lastName]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .trim()

  return {
    tipo: 'persona',
    denominazione,
    codiceFiscale: contatto.taxCode,
    partitaIva: null,
    indirizzo: null,
    citta: null,
    provincia: null,
    cap: null,
    pec: null,
    codiceDestinatario: null,
  }
}

/**
 * Cosa manca allo snapshot perché la fattura sia emettibile: serve un
 * identificativo fiscale (CF o P.IVA) e una denominazione. L'elenco è vuoto
 * quando la fattura si può emettere.
 */
export function datiFiscaliMancanti(snapshot: SnapshotCliente): string[] {
  const mancanti: string[] = []
  if (!snapshot.denominazione) mancanti.push('la denominazione del cliente')
  if (!snapshot.codiceFiscale && !snapshot.partitaIva) {
    mancanti.push('il codice fiscale o la partita IVA')
  }
  return mancanti
}
