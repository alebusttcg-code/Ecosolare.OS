/**
 * Le intestazioni HTTP con cui Chromium va a prendere la pagina da stampare.
 *
 * Un segreto incollato in un pannello di configurazione porta con sé, ogni
 * tanto, l'a-capo che lo seguiva. Come valore di variabile d'ambiente non dà
 * fastidio a nessuno e nessuno se ne accorge; come valore di intestazione HTTP
 * fa fallire il protocollo con «Network.setExtraHTTPHeaders: Invalid header
 * value» — un messaggio che non dice quale intestazione, non dice quale
 * carattere, e manda a cercare il problema nella parte sbagliata del sistema.
 *
 * Qui i valori si ripuliscono, e quello che resta illegale si ferma con un
 * errore che dice **quale** intestazione e **perché**. Mai il valore: sono
 * segreti, e un messaggio d'errore finisce nei log.
 */

/** Caratteri ammessi in un valore di intestazione: ASCII stampabile. */
const AMMESSI = /^[\x20-\x7e]*$/

export function intestazioniStampa(
  valori: Readonly<Record<string, string | null | undefined>>,
): Record<string, string> {
  const pulite: Record<string, string> = {}

  for (const [nome, valore] of Object.entries(valori)) {
    if (valore == null) continue
    const pulito = valore.trim()
    if (pulito === '') continue

    if (!AMMESSI.test(pulito)) {
      throw new Error(
        `L’intestazione «${nome}» contiene caratteri non ammessi: il valore è ` +
          'stato probabilmente incollato con un a capo, una tabulazione o un ' +
          'carattere non ASCII. Va corretto nella configurazione.',
      )
    }

    pulite[nome] = pulito
  }

  return pulite
}
