import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { registraFontiPreventivo } from '@/lib/pdf/fonti-preventivo'
import {
  DocumentoAnteprimaCopertinaPremium,
  DocumentoPreventivo,
} from '@/lib/pdf/preventivo'
import { PAGINE_MARKETING } from '@/lib/pdf/testi-marketing'

function dataUri(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`
}

async function main() {
  const root = process.cwd()
  const completo = process.argv.includes('--completo')
  const argomenti = process.argv.slice(2).filter((argomento) => argomento !== '--completo')
  const heroPath = argomenti[0]
  const outputPath = argomenti[1] ?? path.join(
    root,
    completo
      ? 'output/pdf/Anteprima-Preventivo-Walter-Ricci-Premium-V2.pdf'
      : 'output/pdf/Anteprima-Copertina-Walter-Ricci-Premium-V2.pdf',
  )
  if (!heroPath) {
    throw new Error(
      'Uso: tsx scripts/genera-anteprima-copertina-premium.tsx [--completo] <hero.png> [output.pdf]',
    )
  }

  registraFontiPreventivo()
  const [logo, hero] = await Promise.all([
    readFile(path.join(root, 'public/brand/ecosolare-logo.png')),
    readFile(heroPath),
  ])

  const dati: DatiPdfPreventivo = {
    codice: 'T-2026-0167',
    titolo: 'Impianto fotovoltaico e caldaia ibrida',
    versione: 1,
    dataDocumento: '03/08/2026',
    validita: null,
    clienteNome: 'Walter Ricci',
    aziendaCliente: null,
    immobileEtichetta: 'Abitazione privata',
    immobileIndirizzo: 'Via Giuncaro, Sarzana (SP)',
    mittente: {
      nome: 'Leopoldo Merani',
      ruolo: 'Resp. Commerciale',
      email: 'comm@ecosolare.biz',
      telefono: null,
    },
    copertinaKpi: {
      moduli: 12,
      kWp: '6',
      produzioneMwh: '7,96',
      consumoMwh: '6,5',
    },
    dettagliImpianto: {
      composizione: '12 moduli da 500 Wp',
      potenzaKwp: '6 kWp',
      produzioneKwh: '7.962 kWh',
      resaSpecifica: '1.327 kWh/kWp·anno',
      consumoKwh: '6.500 kWh',
      falde: [],
      regimeRid: 'Ritiro Dedicato',
      detrazioneSintesi: 'Detrazione fiscale 50% in 10 anni.',
      moduli: 12,
      kWpNumero: 6,
      produzioneKwhNumero: 7962,
      wattPicco: 500,
    },
    condizioniEconomiche: {
      totaleLordo: '€ 24.300,00',
      detrazioneEtichetta: 'Detrazione fiscale',
      detrazioneImporto: '€ 5.900,00',
      contoTermicoImporto: '€ 2.950,00',
      nettoIndicativo: '€ 15.450,00',
      bollettaAttualeMensile: '€ 162,50',
      bollettaConFvMensile: '€ 34,60',
      creditoMensile: null,
      risparmioMensile: '€ 127,90',
      risparmioAnnuo: '€ 1.534,80',
      paybackAnni: '3,8 anni',
      notePagamento: '',
    },
    bloccoTermico: null,
    configurazioneTecnica: [
      {
        titolo: 'Impianto fotovoltaico',
        voci: [
          'N. 12 moduli fotovoltaici bifacciali monocristallini da 500 Wp',
          'N. 1 inverter ibrido da 6 kW',
          'Struttura certificata e protezioni elettriche complete',
        ],
      },
      {
        titolo: 'Centrale termica',
        voci: [
          'Sistema ibrido ad alta efficienza per riscaldamento e acqua calda',
          'Regolazione climatica e collegamenti idraulici previsti in offerta',
        ],
      },
    ],
    dossierTestuale: {
      incluso: [
        'Progettazione, pratiche autorizzative e connessione alla rete',
        'Fornitura, installazione, collaudo e messa in servizio',
        'Assistenza per l’accesso alle agevolazioni selezionate',
      ],
      escluso: [
        'Opere murarie non espressamente indicate',
        'Adeguamenti dell’impianto elettrico esistente non rilevabili in sopralluogo',
      ],
      garanzie: [
        {
          titolo: 'Garanzie incluse',
          punti: [
            '10 anni sull’installazione EcoSolare',
            '25 anni sulla resa dei moduli fotovoltaici',
            'Garanzia dei produttori sui singoli componenti',
          ],
        },
      ],
      notaGaranzia: 'Le condizioni complete sono riportate nella documentazione tecnica allegata.',
    },
    planimetria: {
      viewBox: '0 0 1718 552',
      poligoniPaths: [],
      moduliPaths: [],
      legenda: '12 moduli fotovoltaici',
      fotoDataUri: dataUri('image/png', hero),
      fotoPixelW: 1718,
      fotoPixelH: 552,
    },
    simulazione: {
      tariffe: '',
      flussi: {
        produzione: '7.962 kWh',
        autoconsumo: '3.694 kWh',
        exportRete: '4.268 kWh',
        daRete: '2.806 kWh',
      },
      flussiNum: {
        produzione: 7962,
        autoconsumo: 3694,
        exportRete: 4268,
        daRete: 2806,
        consumo: 6500,
      },
      produzioneMensileKwh: [390, 470, 690, 790, 920, 990, 1030, 910, 720, 520, 310, 222],
      npv: '€ 36.250,00',
      npvCents: 3625000,
      paybackAnni: '3,8 anni',
      cashflow: Array.from({ length: 10 }, (_, indice) => ({
        anno: String(indice + 1),
        risparmio: `€ ${Math.round(1535 * (1 + indice * 0.02)).toLocaleString('it-IT')}`,
        risparmioTermico: null,
        detrazione: '€ 590',
        contoTermico: null,
        flusso: `€ ${Math.round(2125 * (1 + indice * 0.015)).toLocaleString('it-IT')}`,
        flussoCents: Math.round(212500 * (1 + indice * 0.015)),
      })),
      cumulato: Array.from({ length: 26 }, (_, indice) => ({
        anno: indice,
        cumulatoEur: -15450 + indice * 2050,
      })),
      indicatori: [
        {
          icona: 'co2',
          etichetta: 'Emissioni CO2 evitate',
          valore: '2,04',
          unita: 't/anno',
        },
      ],
      kpiFinanziari: [
        { etichetta: 'Tempo di rientro', valore: '3,8 anni', tono: 'beneficio' },
        { etichetta: 'VAN a 25 anni', valore: '€ 36.250', tono: 'beneficio' },
        { etichetta: 'Investimento netto', valore: '€ 15.450', tono: 'costo' },
      ],
      termico: null,
      orizzonteAnni: 25,
    },
    righe: [
      {
        descrizione: 'Impianto fotovoltaico 6 kWp chiavi in mano',
        quantita: '1',
        unita: 'corpo',
        prezzoUnitario: '€ 12.800,00',
        scontoPct: null,
        ivaPct: '10%',
        importo: '€ 12.800,00',
      },
      {
        descrizione: 'Sistema ibrido per centrale termica',
        quantita: '1',
        unita: 'corpo',
        prezzoUnitario: '€ 9.290,91',
        scontoPct: null,
        ivaPct: '10%',
        importo: '€ 9.290,91',
      },
    ],
    scontoGlobalePct: null,
    imponibile: '€ 22.090,91',
    ripartizioneIva: [],
    totaleIva: '€ 2.209,09',
    totaleLordo: '€ 24.300,00',
    note: null,
  }

  const immaginiMarketing = await Promise.all(
    PAGINE_MARKETING.map((pagina) =>
      Promise.all(
        pagina.immagini.map(async (relativo) => {
          const bytes = await readFile(path.join(root, 'public', relativo))
          const mime = relativo.endsWith('.jpg') || relativo.endsWith('.jpeg')
            ? 'image/jpeg'
            : 'image/png'
          return dataUri(mime, bytes)
        }),
      ),
    ),
  )

  const documento = (
    completo ? (
      <DocumentoPreventivo
        dati={dati}
        logoSrc={dataUri('image/png', logo)}
        immaginiMarketing={immaginiMarketing}
        copertinaPremium
      />
    ) : (
      <DocumentoAnteprimaCopertinaPremium
        dati={dati}
        logoSrc={dataUri('image/png', logo)}
      />
    )
  ) as ReactElement<DocumentProps>

  const pdf = await renderToBuffer(documento)
  await writeFile(outputPath, pdf)
  process.stdout.write(`${outputPath}\n`)
}

void main()
