/**
 * L'indirizzo del chiamante, per quanto ci si possa fidare.
 *
 * **Un'intestazione HTTP non è una prova.** `x-forwarded-for` la scrive il
 * client e si falsifica in un secondo; quando arriva a noi è già passata dal
 * proxy della piattaforma, che la riscrive, ma la catena la conosce solo chi
 * ha configurato il deploy. Per questo l'indirizzo qui serve a **distribuire**
 * il limite, non a garantirlo: la garanzia è il contatore globale, che non
 * dipende da nessuna intestazione.
 *
 * L'ordine di preferenza va dal meno falsificabile al più: `x-vercel-*` la
 * mette il proxy di Vercel e sovrascrive quella in arrivo, `x-real-ip` la
 * mettono quasi tutti i reverse proxy, e solo per ultimo si guarda il primo
 * elemento di `x-forwarded-for`.
 */

/** IPv6 esteso: 39 caratteri. Con la zona e qualche margine, 45 bastano. */
const LUNGHEZZA_MASSIMA = 45

/** Quando non si riesce a distinguere il chiamante, finiscono tutti insieme. */
export const IP_SCONOSCIUTO = 'sconosciuto'

/**
 * Solo cifre, lettere esadecimali, punti, due punti e percento (zona IPv6).
 * Non è una validazione di indirizzo: è un filtro perché una chiave del
 * contatore non diventi il posto dove un attaccante scrive quello che vuole.
 */
const FORMA_AMMESSA = /^[0-9a-f.:%]+$/i

function ripulisci(valore: string | null | undefined): string | null {
  if (!valore) return null
  const primo = valore.split(',')[0]?.trim().toLowerCase() ?? ''
  if (primo === '' || primo.length > LUNGHEZZA_MASSIMA) return null
  if (!FORMA_AMMESSA.test(primo)) return null
  return primo
}

export function indirizzoChiamante(intestazioni: Headers): string {
  return (
    ripulisci(intestazioni.get('x-vercel-forwarded-for')) ??
    ripulisci(intestazioni.get('x-real-ip')) ??
    ripulisci(intestazioni.get('x-forwarded-for')) ??
    IP_SCONOSCIUTO
  )
}
