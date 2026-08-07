/**
 * Nomi delle cartelle su Drive.
 *
 * Sono la parte che le persone vedono davvero: la cartella la aprono loro, e
 * un nome che non permette di riconoscere il cliente a colpo d'occhio rende
 * inutile tutto il resto. Per questo sta qui, isolata e provata, invece che
 * dentro la chiamata HTTP.
 */

/**
 * Caratteri che rompono il nome o lo rendono ambiguo.
 *
 * `/` e `\` non sono vietati da Drive, ma nelle esportazioni e nei client di
 * sincronizzazione diventano separatori di percorso e spezzano la cartella in
 * due. I caratteri di controllo non si vedono e si portano dietro sorprese.
 */
const VIETATI = /[/\\<>:"|?*\u0000-\u001f\u007f]/g

const LUNGHEZZA_MASSIMA = 120

export function ripulisciNomeCartella(nome: string): string {
  const pulito = nome
    .replace(VIETATI, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Un punto finale viene mangiato da alcuni client di sincronizzazione.
    .replace(/\.+$/, '')
    .trim()

  return pulito.slice(0, LUNGHEZZA_MASSIMA).trim()
}

export interface DatiCliente {
  readonly firstName: string | null
  readonly lastName: string
  readonly companyName?: string | null
}

/**
 * Nome della cartella di un cliente.
 *
 * Cognome prima del nome: le cartelle in Drive si ordinano alfabeticamente, e
 * un elenco ordinato per nome di battesimo non serve a nessuno che stia
 * cercando un cliente.
 *
 * Per i clienti aziendali comanda la ragione sociale, con il referente fra
 * parentesi: è così che le persone li chiamano.
 */
export function nomeCartellaCliente(cliente: DatiCliente): string {
  const persona = [cliente.lastName, cliente.firstName].filter(Boolean).join(' ')
  const azienda = cliente.companyName?.trim()

  const nome = azienda ? (persona ? `${azienda} (${persona})` : azienda) : persona
  const pulito = ripulisciNomeCartella(nome)

  // Un contatto senza cognome non dovrebbe esistere (la colonna è not null),
  // ma una cartella chiamata «» sarebbe irrecuperabile: meglio un ripiego.
  return pulito || 'Cliente senza nome'
}

/**
 * Nome della sottocartella di una commessa.
 *
 * Il codice per primo perché è l'unica parte stabile: il titolo si può
 * cambiare, il codice no, ed è quello che compare sui documenti.
 */
export function nomeCartellaCommessa(params: {
  code: string
  title: string
}): string {
  const titolo = ripulisciNomeCartella(params.title)
  const codice = ripulisciNomeCartella(params.code)
  return ripulisciNomeCartella(titolo ? `${codice} — ${titolo}` : codice)
}
