/**
 * Perché la pompa di calore non entra nel piano economico.
 *
 * Il motore è severo di proposito: senza gas consumato, SCOP e prezzo del gas
 * non inventa un risparmio, e il capitolo termico resta descrittivo. È la
 * scelta giusta — meglio un capitolo muto che un beneficio inventato — ma
 * finora era **silenziosa**: il commerciale mandava un preventivo in cui la
 * pompa di calore era solo un costo, il rientro usciva peggiore del vero, e
 * nessuno sapeva che era mancato un campo.
 *
 * Questo modulo non decide niente: dice soltanto cosa manca e dove si compila.
 * La regola di calcolo resta una sola, in `simulaImpiantoFv`, e questa
 * diagnosi ne ricalca le condizioni.
 */

export interface IngressiTermico {
  /** Gas dell'ultimo anno, dalla bolletta del cliente, in Smc. */
  readonly consumoGasAnnuoSmc: number | null | undefined
  /** Rendimento stagionale: dal catalogo del prodotto o scritto a mano. */
  readonly scop: number | null | undefined
  /** Prezzo del gas: dal preventivo o dalla configurazione aziendale. */
  readonly prezzoGasEurSmc: number | null | undefined
}

export interface DatoMancante {
  /** Che cosa manca, in una riga. */
  readonly cosa: string
  /** Dove si compila, perché non sono tutti nella stessa schermata. */
  readonly dove: string
}

function assente(valore: number | null | undefined): boolean {
  return !(typeof valore === 'number' && Number.isFinite(valore) && valore > 0)
}

/**
 * L'elenco di ciò che manca, in ordine di dove si va a metterlo.
 * Vuoto significa che il termico entra nel piano.
 */
export function datiMancantiTermico(
  ingressi: IngressiTermico,
): readonly DatoMancante[] {
  const mancanti: DatoMancante[] = []

  if (assente(ingressi.consumoGasAnnuoSmc)) {
    mancanti.push({
      cosa: 'il gas consumato nell’ultimo anno',
      dove: 'nello studio tetto, sezione Sviluppo — è sulla bolletta del cliente',
    })
  }
  if (assente(ingressi.scop)) {
    mancanti.push({
      cosa: 'lo SCOP della pompa di calore',
      dove: 'nel catalogo prodotti, oppure qui sotto per questo preventivo',
    })
  }
  if (assente(ingressi.prezzoGasEurSmc)) {
    mancanti.push({
      cosa: 'il prezzo del gas',
      dove: 'qui sotto, oppure come valore aziendale nelle impostazioni',
    })
  }

  return mancanti
}

/** Vero quando il risparmio sul riscaldamento entra davvero nei conti. */
export function termicoEntraNelPiano(ingressi: IngressiTermico): boolean {
  return datiMancantiTermico(ingressi).length === 0
}

/**
 * I tre dati messi insieme da dove vivono davvero.
 *
 * Non è una comodità: la combinazione è la parte che si sbaglia. Lo SCOP può
 * arrivare dal catalogo o dal campo a mano, il prezzo del gas dal preventivo o
 * dalla configurazione aziendale, e il gas consumato solo dallo studio tetto.
 * Tenerla dentro un componente di ottocento righe vorrebbe dire non poterla
 * verificare.
 */
export function ingressiTermico(dati: {
  /** Dallo studio tetto: non ha alternative, o c'è o non c'è. */
  readonly consumoGasAnnuoSmc: number | null | undefined
  /** Dal catalogo del prodotto. */
  readonly scopCatalogo: number | null | undefined
  /** Scritto a mano nel preventivo, quando il catalogo tace. */
  readonly scopManuale: number | null | undefined
  /** Scritto a mano nel preventivo: è il gas del cliente. */
  readonly prezzoGasManuale: number | null | undefined
  /** Valore aziendale configurato, quando il preventivo tace. */
  readonly prezzoGasPredefinito: number | null | undefined
}): IngressiTermico {
  const primoValido = (
    ...valori: readonly (number | null | undefined)[]
  ): number | null => {
    for (const valore of valori) {
      if (typeof valore === 'number' && Number.isFinite(valore) && valore > 0) {
        return valore
      }
    }
    return null
  }

  return {
    consumoGasAnnuoSmc: primoValido(dati.consumoGasAnnuoSmc),
    scop: primoValido(dati.scopCatalogo, dati.scopManuale),
    prezzoGasEurSmc: primoValido(dati.prezzoGasManuale, dati.prezzoGasPredefinito),
  }
}
