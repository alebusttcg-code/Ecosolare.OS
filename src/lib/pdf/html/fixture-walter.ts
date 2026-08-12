import {
  ATTIVITA_TERMICO,
  ESCLUSO_OFFERTA,
  INCLUSO_FV,
  TITOLO_TERMICO,
} from '@/lib/pdf/dossier-testi'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'

export const WALTER_RICCI_HTML_FIXTURE: DatiPdfPreventivo = {
  codice: 'T-2026-0167',
  titolo: 'Impianto fotovoltaico e caldaia ibrida',
  versione: 1,
  dataDocumento: '03/08/2026',
  validita: '17/08/2026',
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
  copertinaKpi: { moduli: 12, kWp: '6,0', produzioneMwh: '7,96', consumoMwh: '6,5' },
  dettagliImpianto: {
    composizione: '12 moduli da 500 Wp',
    potenzaKwp: '6,0 kWp',
    produzioneKwh: '7.962 kWh',
    resaSpecifica: '1.327 kWh/kWp·anno',
    consumoKwh: '6.500 kWh',
    falde: [{ etichetta: 'Falda principale', inclinazione: '22°', esposizione: 'Sud-Est', area: '62 m²' }],
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
  bloccoTermico: {
    tipoEtichetta: 'Caldaia ibrida',
    descrizione: 'Sistema ibrido ad alta efficienza per riscaldamento e acqua calda sanitaria.',
    // IVA inclusa davvero: 9.290,91 di imponibile + 10% = 10.220,00.
    prezzoLordo: '€ 10.220,00',
    incentivoEtichetta: 'Conto Termico 3.0',
    incentivoImporto: '€ 2.950,00',
    notaIncentivo: 'Il piano utilizza soltanto l’agevolazione selezionata.',
    nettoIndicativo: '€ 7.270,00',
  },
  /*
   * Le stesse costanti che usa `quotes.ts`: se la dimostrazione mostrasse voci
   * scritte a mano, non proverebbe niente sul documento vero — e le differenze
   * di copy si scoprirebbero davanti al cliente.
   */
  configurazioneTecnica: [
    {
      titolo: 'Impianto fotovoltaico',
      voci: [
        '12 Pannelli FV Viessmann Vitovolt 500 Wp M-WT Bifacciali, Monocristallino Alto Rendimento.',
        '1 Inverter Viessmann / Solplanet Hybrid Inverter da 6 kW.',
        'Struttura di montaggio certificata Wurth, fissaggi in acciaio inox.',
        'Fornitura e posa linea in Corrente Continua fra moduli e quadro inverter, dimensionata in base al progetto.',
        'Fornitura e posa linea in Corrente Alternata fino al quadro esistente, dimensionata in base al progetto.',
        'Cavo solare a doppia schermatura.',
        'Quadri, centralini, sezionatori e scaricatori di sovratensione Schneider / ABB.',
      ],
    },
    {
      titolo: TITOLO_TERMICO.ibrido,
      voci: [
        'Caldaia Ibrida Daikin HPU Hybrid 8 kW, con bruciatore gas 33 kW e pompa di calore per riscaldamento e acqua calda sanitaria.',
        ...ATTIVITA_TERMICO.ibrido,
        'Rendimento stagionale dichiarato (SCOP): 4.',
      ],
    },
  ],
  dossierTestuale: {
    incluso: INCLUSO_FV,
    escluso: ESCLUSO_OFFERTA,
    garanzie: [{ titolo: 'Garanzie di prodotto e installazione', punti: ['10 anni sull’installazione EcoSolare.', '25 anni sulla resa dei moduli fotovoltaici.', 'Garanzia ufficiale dei produttori sui singoli componenti.'] }],
    notaGaranzia: 'Le condizioni complete sono riportate nella documentazione tecnica allegata al preventivo.',
  },
  planimetria: {
    viewBox: '0 0 934 447',
    poligoniPaths: [],
    moduliPaths: [],
    legenda: '12 moduli fotovoltaici - layout dallo studio tetto EcoSolare',
    fotoDataUri: '/preventivo/reference/walter-hero.jpg',
    // Nel CRM reale è la cattura gemella senza pannelli; la fixture riusa la
    // reference solo per verificare la composizione a due colonne.
    /*
     * Volutamente assente: per questa dimostrazione non esiste una cattura del
     * tetto senza moduli, e riusare la stessa foto farebbe apparire un
     * confronto «prima/dopo» fra due immagini identiche.
     */
    fotoSenzaModuliDataUri: null,
    fotoConModuliIntegrati: true,
    fotoPixelW: 934,
    fotoPixelH: 447,
    focusXPct: 50,
    focusYPct: 50,
  },
  simulazione: {
    tariffe: 'Scenario calcolato con parametri EcoSolare versionati al 03/08/2026.',
    flussi: { produzione: '7.962 kWh', autoconsumo: '3.694 kWh', exportRete: '4.268 kWh', daRete: '2.806 kWh' },
    flussiNum: { produzione: 7962, autoconsumo: 3694, exportRete: 4268, daRete: 2806, consumo: 6500 },
    produzioneMensileKwh: [390, 470, 690, 790, 920, 990, 1030, 910, 720, 520, 310, 222],
    npv: '€ 36.250,00',
    npvCents: 3625000,
    paybackAnni: '3,8 anni',
    cashflow: Array.from({ length: 25 }, (_, indice) => ({ anno: String(indice + 1), risparmio: `€ ${Math.round(1535 * (1 + indice * .02)).toLocaleString('it-IT')}`, risparmioTermico: null, detrazione: indice < 10 ? '€ 590' : '€ 0', contoTermico: null, flusso: `€ ${Math.round((1535 + (indice < 10 ? 590 : 0)) * (1 + indice * .015)).toLocaleString('it-IT')}`, flussoCents: Math.round((153500 + (indice < 10 ? 59000 : 0)) * (1 + indice * .015)) })),
    cumulato: Array.from({ length: 26 }, (_, indice) => ({ anno: indice, cumulatoEur: -15450 + indice * 2050 })),
    indicatori: [
      { icona: 'co2', etichetta: 'Emissioni CO₂ evitate', valore: '2,04', unita: 't/anno' },
      { icona: 'alberi', etichetta: 'Alberi equivalenti', valore: '93', unita: 'alberi' },
      { icona: 'autonomia', etichetta: 'Autonomia energetica', valore: '57', unita: '%' },
      { icona: 'energia', etichetta: 'Energia autoprodotta', valore: '7,96', unita: 'MWh' },
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
    { descrizione: 'Impianto fotovoltaico 6 kWp chiavi in mano', quantita: '1', unita: 'corpo', prezzoUnitario: '€ 12.800,00', scontoPct: null, ivaPct: '10%', importo: '€ 12.800,00' },
    { descrizione: 'Sistema ibrido per centrale termica', quantita: '1', unita: 'corpo', prezzoUnitario: '€ 9.290,91', scontoPct: null, ivaPct: '10%', importo: '€ 9.290,91' },
  ],
  scontoGlobalePct: null,
  imponibile: '€ 22.090,91',
  ripartizioneIva: [{ etichetta: 'IVA 10%', imponibile: '€ 22.090,91', imposta: '€ 2.209,09' }],
  totaleIva: '€ 2.209,09',
  totaleLordo: '€ 24.300,00',
  note: null,
}
