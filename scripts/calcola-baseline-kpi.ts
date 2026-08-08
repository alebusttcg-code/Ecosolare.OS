/**
 * Calcola i KPI di baseline dal foglio CSV di Sprint 0.
 *
 *   npm run baseline              # KPI su docs/baseline-kpi.csv
 *   npm run baseline:stato        # avanzamento compilazione
 *   npm run baseline -- --salva   # scrive risultati in docs/03-baseline-kpi.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const modalitaStato = args.includes('--stato')
const modalitaSalva = args.includes('--salva')
const fileArg = args.find((a) => !a.startsWith('--'))
const PERCORSO = resolve(fileArg ?? 'docs/baseline-kpi.csv')
const DOCS_RISULTATI = resolve('docs/03-baseline-kpi.md')

interface Riga {
  readonly id: string
  readonly linea: string
  readonly fonte: string
  readonly dataPrimoContatto: Date | null
  readonly dataPrimaRisposta: Date | null
  readonly dataAppuntamento: Date | null
  readonly dataSopralluogo: Date | null
  readonly dataInvioPreventivo: Date | null
  readonly nVersioni: number | null
  readonly nRichiami: number | null
  readonly valorePreventivo: number | null
  readonly esito: string
  readonly motivoPerdita: string
  readonly dataFirma: Date | null
  readonly dataInizioCantiere: Date | null
  readonly dataFineCantiere: Date | null
  readonly giorniBlocco: number | null
  readonly motivoBlocco: string
  readonly orePreviste: number | null
  readonly oreEffettive: number | null
  readonly costoMaterialiPrevisto: number | null
  readonly costoMaterialiReale: number | null
  readonly dataFatturaSaldo: Date | null
  readonly dataIncassoSaldo: Date | null
}


function parseCsv(contenuto: string): string[][] {
  const righe: string[][] = []
  let campo = ''
  let riga: string[] = []
  let inVirgolette = false

  for (let i = 0; i < contenuto.length; i++) {
    const c = contenuto[i]!
    if (inVirgolette) {
      if (c === '"') {
        if (contenuto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          inVirgolette = false
        }
      } else {
        campo += c
      }
      continue
    }
    if (c === '"') {
      inVirgolette = true
    } else if (c === ',') {
      riga.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenuto[i + 1] === '\n') i++
      riga.push(campo)
      if (riga.some((cella) => cella.trim() !== '')) righe.push(riga)
      riga = []
      campo = ''
    } else {
      campo += c
    }
  }
  if (campo.length > 0 || riga.length > 0) {
    riga.push(campo)
    if (riga.some((cella) => cella.trim() !== '')) righe.push(riga)
  }
  return righe
}

function parseData(valore: string): Date | null {
  const v = valore.trim()
  if (!v || v.toLowerCase() === 'n/d') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseNumero(valore: string): number | null {
  const v = valore.trim()
  if (!v || v.toLowerCase() === 'n/d') return null
  const n = Number.parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function valoreCompilato(valore: string): boolean {
  const v = valore.trim()
  return v !== '' && v.toLowerCase() !== 'n/d'
}

function giorniTra(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function mediana(valori: number[]): number | null {
  if (valori.length === 0) return null
  const ordinati = [...valori].sort((x, y) => x - y)
  const mezzo = Math.floor(ordinati.length / 2)
  return ordinati.length % 2 === 0
    ? (ordinati[mezzo - 1]! + ordinati[mezzo]!) / 2
    : ordinati[mezzo]!
}

function media(valori: number[]): number | null {
  if (valori.length === 0) return null
  return valori.reduce((a, b) => a + b, 0) / valori.length
}

function moda(valori: string[]): string | null {
  if (valori.length === 0) return null
  const conteggi = new Map<string, number>()
  for (const v of valori) conteggi.set(v, (conteggi.get(v) ?? 0) + 1)
  let migliore = ''
  let max = 0
  for (const [k, n] of conteggi) {
    if (n > max) {
      max = n
      migliore = k
    }
  }
  return migliore
}

function percentuale(parte: number, totale: number): string {
  if (totale === 0) return 'n/d'
  return `${Math.round((parte / totale) * 1000) / 10}%`
}

function formattaGiorni(n: number | null): string {
  return n === null ? 'n/d' : `${Math.round(n * 10) / 10} gg`
}

function formattaEuro(n: number | null): string {
  return n === null
    ? 'n/d'
    : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function mappaRiga(celle: string[]): Riga {
  return {
    id: celle[0] ?? '',
    linea: normalizzaLinea(celle[1] ?? ''),
    fonte: celle[2] ?? '',
    dataPrimoContatto: parseData(celle[3] ?? ''),
    dataPrimaRisposta: parseData(celle[4] ?? ''),
    dataAppuntamento: parseData(celle[5] ?? ''),
    dataSopralluogo: parseData(celle[6] ?? ''),
    dataInvioPreventivo: parseData(celle[7] ?? ''),
    nVersioni: parseNumero(celle[8] ?? ''),
    nRichiami: parseNumero(celle[9] ?? ''),
    valorePreventivo: parseNumero(celle[10] ?? ''),
    esito: (celle[11] ?? '').trim().toLowerCase(),
    motivoPerdita: celle[12] ?? '',
    dataFirma: parseData(celle[13] ?? ''),
    dataInizioCantiere: parseData(celle[14] ?? ''),
    dataFineCantiere: parseData(celle[15] ?? ''),
    giorniBlocco: parseNumero(celle[16] ?? ''),
    motivoBlocco: celle[17] ?? '',
    orePreviste: parseNumero(celle[18] ?? ''),
    oreEffettive: parseNumero(celle[19] ?? ''),
    costoMaterialiPrevisto: parseNumero(celle[20] ?? ''),
    costoMaterialiReale: parseNumero(celle[21] ?? ''),
    dataFatturaSaldo: parseData(celle[22] ?? ''),
    dataIncassoSaldo: parseData(celle[23] ?? ''),
  }
}

function normalizzaLinea(linea: string): string {
  const v = linea.trim().toLowerCase()
  if (v === 'fotovoltaico' || v === 'fv') return 'fv'
  return v
}

function rigaSignificativa(r: Riga): boolean {
  if (r.esito === 'vinto' || r.esito === 'perso' || r.esito === 'aperto') return true
  if (valoreCompilato(r.linea) || valoreCompilato(r.fonte)) return true
  if (r.dataPrimoContatto || r.dataPrimaRisposta || r.dataInvioPreventivo) return true
  return false
}

function bloccoACompleto(celle: string[]): boolean {
  const indici = [1, 2, 3, 4, 5, 6, 7, 11]
  return indici.every((i) => valoreCompilato(celle[i] ?? ''))
}

function caricaDati(): { tabella: string[][]; righe: Riga[]; righeCsv: string[][] } {
  const contenuto = readFileSync(PERCORSO, 'utf8')
  const tabella = parseCsv(contenuto)
  if (tabella.length < 2) {
    console.error('Il file non contiene righe dati.')
    process.exit(1)
  }
  const righeCsv = tabella.slice(1).filter((r) => r[0] && !r[0]!.startsWith('ESEMPIO'))
  const righe = righeCsv.map(mappaRiga)
  return { tabella, righe, righeCsv }
}

function stampaStato(righe: Riga[], righeCsv: string[][]): void {
  console.log(`\nBaseline KPI — avanzamento`)
  console.log(`File: ${PERCORSO}\n`)

  const totaleSlot = righe.length
  const significative = righe.filter(rigaSignificativa)
  const bloccoAOk = righeCsv.filter(bloccoACompleto).length
  const vinti = significative.filter((r) => r.esito === 'vinto').length
  const persi = significative.filter((r) => r.esito === 'perso').length
  const aperti = significative.filter((r) => r.esito === 'aperto').length

  console.log('─'.repeat(52))
  console.log(`Righe nel foglio              ${totaleSlot}`)
  console.log(`Pratiche con dati             ${significative.length}`)
  console.log(`Blocco A completo             ${bloccoAOk} / ${totaleSlot}`)
  console.log(`Mix esito (significative)     vinto ${vinti} · perso ${persi} · aperto ${aperti}`)
  console.log('─'.repeat(52))

  if (significative.length === 0) {
    console.log('\nNessuna riga compilata ancora.')
    console.log('Apri docs/baseline-campione.md e scegli le 25 pratiche, poi compila baseline-kpi.csv.\n')
    return
  }

  console.log('\nPer riga (● = blocco A ok):\n')
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i]!
    const celle = righeCsv[i]!
    if (!rigaSignificativa(r) && r.id.startsWith('PRATICA-')) continue
    const segno = bloccoACompleto(celle) ? '●' : '○'
    const esito = r.esito || '—'
    console.log(`  ${segno} ${r.id.padEnd(22)} ${esito}`)
  }

  console.log('\nObiettivo campione: 25 pratiche, blocco A ≥ 20, mix ~12 vinte / 8 perse / 5 problematiche.')
  console.log('Guida: docs/baseline-campione.md\n')
}

function conversionePerFonte(righe: Riga[]): string[] {
  const perFonte = new Map<string, { vinti: number; persi: number }>()
  for (const r of righe) {
    if (r.esito !== 'vinto' && r.esito !== 'perso') continue
    if (!valoreCompilato(r.fonte)) continue
    const attuale = perFonte.get(r.fonte) ?? { vinti: 0, persi: 0 }
    if (r.esito === 'vinto') attuale.vinti++
    else attuale.persi++
    perFonte.set(r.fonte, attuale)
  }
  return [...perFonte.entries()]
    .sort((a, b) => b[1].vinti + b[1].persi - (a[1].vinti + a[1].persi))
    .map(([fonte, { vinti, persi }]) => {
      const tot = vinti + persi
      return `  ${fonte.padEnd(20)} ${percentuale(vinti, tot)} (${vinti}/${tot})`
    })
}

function calcolaReport(righe: Riga[], tabella: string[][]): string {
  const speedToLead = righe
    .filter((r) => r.dataPrimoContatto && r.dataPrimaRisposta)
    .map((r) => giorniTra(r.dataPrimoContatto!, r.dataPrimaRisposta!))

  const sopralluogoPreventivo = righe
    .filter((r) => r.dataSopralluogo && r.dataInvioPreventivo)
    .map((r) => giorniTra(r.dataSopralluogo!, r.dataInvioPreventivo!))

  const firmaCantiere = righe
    .filter((r) => r.dataFirma && r.dataInizioCantiere)
    .map((r) => giorniTra(r.dataFirma!, r.dataInizioCantiere!))

  const durataCommessa = righe
    .filter((r) => r.dataFirma && r.dataFineCantiere)
    .map((r) => giorniTra(r.dataFirma!, r.dataFineCantiere!))

  const incasso = righe
    .filter((r) => r.dataFatturaSaldo && r.dataIncassoSaldo)
    .map((r) => giorniTra(r.dataFatturaSaldo!, r.dataIncassoSaldo!))

  const vinti = righe.filter((r) => r.esito === 'vinto')
  const persi = righe.filter((r) => r.esito === 'perso')
  const chiusi = vinti.length + persi.length

  const ticketMedio = media(vinti.map((r) => r.valorePreventivo).filter((n): n is number => n !== null))

  const giorniBlocco = righe.map((r) => r.giorniBlocco).filter((n): n is number => n !== null)
  const motiviBlocco = righe
    .map((r) => r.motivoBlocco.trim())
    .filter((m) => m && m.toLowerCase() !== 'n/d')

  const richiami = righe.map((r) => r.nRichiami).filter((n): n is number => n !== null)

  const sommaOrePrev = righe.reduce((a, r) => a + (r.orePreviste ?? 0), 0)
  const sommaOreEff = righe.reduce((a, r) => a + (r.oreEffettive ?? 0), 0)
  const sommaMatPrev = righe.reduce((a, r) => a + (r.costoMaterialiPrevisto ?? 0), 0)
  const sommaMatReale = righe.reduce((a, r) => a + (r.costoMaterialiReale ?? 0), 0)

  const celleTotali = righe.length * 24
  const celleNd = tabella
    .slice(1)
    .flat()
    .filter((c) => c.trim().toLowerCase() === 'n/d').length

  const righeReport = [
    `Baseline KPI — ${righe.length} pratiche`,
    `File: ${PERCORSO}`,
    `Generato: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '─'.repeat(52),
    `Speed-to-lead (mediana)     ${formattaGiorni(mediana(speedToLead))}  (n=${speedToLead.length})`,
    `Lead → appuntamento         ${percentuale(righe.filter((r) => r.dataAppuntamento).length, righe.length)}`,
    `Appuntamento → sopralluogo    ${percentuale(righe.filter((r) => r.dataSopralluogo).length, righe.length)}`,
    `Sopralluogo → preventivo    ${formattaGiorni(mediana(sopralluogoPreventivo))}  (n=${sopralluogoPreventivo.length})`,
    `Conversione                 ${percentuale(vinti.length, chiusi)} (${vinti.length}/${chiusi})`,
    `Ticket medio (vinti)        ${formattaEuro(ticketMedio)}`,
    `Firma → cantiere (mediana)  ${formattaGiorni(mediana(firmaCantiere))}  (n=${firmaCantiere.length})`,
    `Durata commessa (mediana)   ${formattaGiorni(mediana(durataCommessa))}  (n=${durataCommessa.length})`,
    `Giorni blocco (media)       ${formattaGiorni(media(giorniBlocco))}`,
    `Motivo blocco prevalente    ${moda(motiviBlocco) ?? 'n/d'}`,
    `Richiami dati (media)       ${media(richiami)?.toFixed(1) ?? 'n/d'}`,
    `Scostamento ore             ${sommaOrePrev > 0 ? `${Math.round((sommaOreEff / sommaOrePrev) * 1000) / 10}%` : 'n/d'}`,
    `Scostamento materiali       ${sommaMatPrev > 0 ? `${Math.round((sommaMatReale / sommaMatPrev) * 1000) / 10}%` : 'n/d'}`,
    `Tempo incasso (mediana)     ${formattaGiorni(mediana(incasso))}  (n=${incasso.length})`,
    `Ricostruibilità (celle n/d) ${percentuale(celleNd, celleTotali)}`,
    '─'.repeat(52),
  ]

  const conversioni = conversionePerFonte(righe)
  if (conversioni.length > 0) {
    righeReport.push('', 'Conversione per fonte:', ...conversioni)
  }

  return righeReport.join('\n')
}

function salvaInDocs(report: string): void {
  const contenuto = readFileSync(DOCS_RISULTATI, 'utf8')
  const marker = '## Risultati (compilare dopo Sprint 0)'
  const idx = contenuto.indexOf(marker)
  if (idx === -1) {
    console.error('Sezione risultati non trovata in docs/03-baseline-kpi.md')
    process.exit(1)
  }

  const nuovoBlocco = `${marker}

\`\`\`
${report}
\`\`\`
`
  const fineSezione = contenuto.indexOf('\n---', idx + marker.length)
  const resto = fineSezione === -1 ? '' : contenuto.slice(fineSezione)
  const aggiornato = contenuto.slice(0, idx) + nuovoBlocco + resto

  writeFileSync(DOCS_RISULTATI, aggiornato, 'utf8')
  console.log(`\n✓ Risultati scritti in docs/03-baseline-kpi.md\n`)
}

function main(): void {
  const { tabella, righe, righeCsv } = caricaDati()

  if (modalitaStato) {
    stampaStato(righe, righeCsv)
    return
  }

  const significative = righe.filter(rigaSignificativa)
  if (significative.length === 0) {
    console.log(`File: ${PERCORSO}`)
    console.log('\nNessuna pratica compilata. Usa docs/baseline-campione.md per iniziare.')
    console.log('Controllo avanzamento: npm run baseline:stato\n')
    process.exit(0)
  }

  if (significative.length < 15) {
    console.log(`\n⚠ Solo ${significative.length} pratiche con dati — i KPI sono indicativi.`)
    console.log('Obiettivo: almeno 20–25. Continua a compilare e rilancia.\n')
  }

  const report = calcolaReport(significative, tabella)
  console.log(`\n${report}\n`)

  if (modalitaSalva) {
    salvaInDocs(report)
  } else {
    console.log('Salva in docs: npm run baseline -- --salva\n')
  }
}

main()
