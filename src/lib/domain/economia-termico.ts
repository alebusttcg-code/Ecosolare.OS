/**
 * L'economia della pompa di calore.
 *
 * Serve a chiudere un buco che nei preventivi di riferimento è enorme: nel
 * dossier Riboldi il cliente firma 34.400 € e l'analisi finanziaria ne
 * considera 11.800, il 34%. «Ammortamento 3,9 anni» si riferisce a un terzo
 * dell'investimento, e i 22.600 € di pompa di calore non compaiono in nessun
 * grafico.
 *
 * Nel nostro sistema il difetto sarebbe **rovesciato e peggiore**: la pompa di
 * calore è una riga del preventivo, quindi entra già nell'investimento totale;
 * senza questo modulo il costo ci sarebbe e il risparmio no, e il rientro
 * apparirebbe molto peggiore del vero. Il cliente vedrebbe un impianto che non
 * conviene, il che è falso quanto il contrario.
 *
 * ## Il modello
 *
 * Si sostituisce un generatore a gas con uno elettrico. Il risparmio è la
 * differenza fra due bollette:
 *
 *     gas evitato        = fabbisogno termico ÷ rendimento caldaia × prezzo gas
 *     elettricità in più = fabbisogno termico ÷ SCOP × prezzo elettricità
 *
 * ## Una scelta prudente, dichiarata
 *
 * L'elettricità in più è valutata **tutta a prezzo di rete**, come se nessuna
 * arrivasse dal fotovoltaico. Non è ottimistico ed è voluto: il fabbisogno
 * termico si concentra da novembre a marzo, cioè nei mesi in cui l'impianto
 * produce meno di un terzo dell'anno. Attribuirgli la stessa quota di
 * autoconsumo del resto dei consumi gonfierebbe il risparmio proprio dove il
 * sole non c'è.
 *
 * Il risparmio calcolato qui è quindi un minimo garantito, non una stima
 * centrata. Se un domani si vorrà essere precisi, serve un profilo mensile del
 * fabbisogno termico — non un coefficiente.
 */

/** Potere calorifico inferiore del gas naturale, kWh per standard metro cubo. */
export const KWH_PER_SMC = 9.45

/** Rendimento stagionale di una caldaia a condensazione in buono stato. */
export const RENDIMENTO_CALDAIA_DEFAULT = 0.92

export interface InputEconomiaTermico {
  /** Fabbisogno termico annuo dell'abitazione, in kWh termici. */
  readonly fabbisognoTermicoKwh: number
  /** Rendimento stagionale della pompa di calore (SCOP). */
  readonly scop: number
  readonly prezzoGasEurSmc: number
  readonly prezzoElettricoEurKwh: number
  readonly rendimentoCaldaia?: number
}

export interface EconomiaTermico {
  /** Elettricità che la pompa di calore consuma in un anno. */
  readonly consumoElettricoAnnuoKwh: number
  /** Gas che non si comprerà più, in standard metri cubi. */
  readonly gasEvitatoSmc: number
  readonly costoGasEvitatoCents: number
  readonly costoElettricoAggiuntivoCents: number
  /** Differenza fra i due: positiva quando la pompa di calore conviene. */
  readonly risparmioAnnuoCents: number
}

function positivo(valore: number): number {
  return Number.isFinite(valore) && valore > 0 ? valore : 0
}

export function calcolaEconomiaTermico(
  input: InputEconomiaTermico,
): EconomiaTermico {
  const fabbisogno = positivo(input.fabbisognoTermicoKwh)
  const scop = positivo(input.scop)
  const rendimento = positivo(input.rendimentoCaldaia ?? RENDIMENTO_CALDAIA_DEFAULT)

  const vuoto: EconomiaTermico = {
    consumoElettricoAnnuoKwh: 0,
    gasEvitatoSmc: 0,
    costoGasEvitatoCents: 0,
    costoElettricoAggiuntivoCents: 0,
    risparmioAnnuoCents: 0,
  }

  if (fabbisogno === 0 || scop === 0 || rendimento === 0) return vuoto

  const gasEvitatoSmc = fabbisogno / rendimento / KWH_PER_SMC
  const costoGasEvitatoCents = Math.round(
    gasEvitatoSmc * positivo(input.prezzoGasEurSmc) * 100,
  )

  const consumoElettricoAnnuoKwh = fabbisogno / scop
  const costoElettricoAggiuntivoCents = Math.round(
    consumoElettricoAnnuoKwh * positivo(input.prezzoElettricoEurKwh) * 100,
  )

  return {
    consumoElettricoAnnuoKwh: Math.round(consumoElettricoAnnuoKwh),
    gasEvitatoSmc: Math.round(gasEvitatoSmc),
    costoGasEvitatoCents,
    costoElettricoAggiuntivoCents,
    risparmioAnnuoCents: costoGasEvitatoCents - costoElettricoAggiuntivoCents,
  }
}

/* -------------------------------------------------------------------------- */
/*  Il fabbisogno, dai consumi dell'ultimo anno                                */
/* -------------------------------------------------------------------------- */

/**
 * Quanto calore serve alla casa, letto dalla bolletta del gas.
 *
 * È il modo più affidabile di saperlo, e l'unico che non richiede stime: il
 * cliente ha il dato in mano, l'anno scorso quel gas l'ha davvero bruciato.
 * Le alternative — stimare da metri quadri e zona climatica, o dedurlo dalla
 * potenza della caldaia — producono numeri che nessuno può verificare e che
 * sbagliano facilmente del trenta per cento.
 *
 * Il conto è la caldaia al contrario: dai metri cubi di gas si risale
 * all'energia bruciata, e da quella al calore effettivamente entrato in casa.
 *
 * ## Il gas che resta
 *
 * Quasi sempre la cucina resta a gas — i dossier di riferimento lo dicono
 * esplicitamente: «permette di rendersi indipendenti dal gas, eventualmente
 * mantenuto solo per usi di cucina». Quel consumo **non** va convertito, o si
 * attribuirebbe alla pompa di calore un fabbisogno che non dovrà mai coprire,
 * e il risparmio ne uscirebbe gonfiato.
 */
export interface InputFabbisognoDaGas {
  /** Consumo di gas dell'ultimo anno, in standard metri cubi (dalla bolletta). */
  readonly consumoGasAnnuoSmc: number
  /**
   * Quota che resta a gas e non viene sostituita, in Smc. Tipicamente la
   * cucina: 100–150 Smc l'anno per una famiglia.
   */
  readonly gasNonSostituitoSmc?: number
  readonly rendimentoCaldaia?: number
}

export function fabbisognoTermicoDaGas(input: InputFabbisognoDaGas): number {
  const totale = positivo(input.consumoGasAnnuoSmc)
  const escluso = Math.min(positivo(input.gasNonSostituitoSmc ?? 0), totale)
  const rendimento = positivo(input.rendimentoCaldaia ?? RENDIMENTO_CALDAIA_DEFAULT)

  if (totale === 0 || rendimento === 0) return 0

  // Smc → kWh bruciati → kWh di calore utile entrato in casa.
  return Math.round((totale - escluso) * KWH_PER_SMC * rendimento)
}

/* -------------------------------------------------------------------------- */
/*  Conto Termico                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Il Conto Termico ripartito sugli anni in cui viene erogato.
 *
 * Nei preventivi di riferimento è dichiarato a pagina 10 — 5.700 € su Riboldi,
 * 2.950 € su Ricci, 5.000 € su Tarantola — e **non compare in nessun flusso di
 * cassa**. È un contributo a fondo perduto vero, e ometterlo peggiora il
 * rientro mostrato al cliente: l'unico caso in cui una dimenticanza gioca
 * contro chi vende.
 *
 * Il GSE lo eroga in rate annuali (due o cinque a seconda dell'intervento) o in
 * un'unica soluzione sotto una certa soglia. Il numero di rate è un input,
 * perché dipende dall'intervento e cambia con le regole.
 */
export function rateContoTermico(
  importoTotaleCents: number,
  anniErogazione: number,
): readonly number[] {
  const totale = Math.max(0, Math.round(importoTotaleCents))
  const anni = Math.max(1, Math.round(anniErogazione))
  if (totale === 0) return []

  const rata = Math.floor(totale / anni)
  const rate: number[] = []
  let assegnato = 0

  for (let i = 1; i <= anni; i += 1) {
    if (i < anni) {
      rate.push(rata)
      assegnato += rata
    } else {
      // L'ultima rata assorbe l'arrotondamento: la somma deve fare il totale.
      rate.push(totale - assegnato)
    }
  }

  return rate
}
