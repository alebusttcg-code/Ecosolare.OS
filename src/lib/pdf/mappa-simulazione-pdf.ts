import { formattaImporto } from '@/lib/domain/money'
import { distribuisciProduzioneMensile } from '@/lib/domain/produzione-fv'
import type { RisultatoSimulazioneFv } from '@/lib/domain/simulazione-fv'
import { TERMINI_PAGAMENTO } from '@/lib/pdf/dossier-testi'
import {
  calcolaIndicatori,
  costoLivellatoEnergiaEurKwh,
  tassoInternoRendimento,
} from '@/lib/domain/indicatori-fv'
import type {
  CondizioniEconomichePdf,
  DettagliImpiantoPdf,
  IndicatorePdf,
  KpiFinanziarioPdf,
  PuntoCumulatoPdf,
  SimulazionePdf,
} from '@/lib/pdf/dati-preventivo'

function kwh(n: number): string {
  return `${n.toLocaleString('it-IT')} kWh`
}

function euroCents(c: number): string {
  return formattaImporto(c)
}

/** Converte il risultato del motore nel DTO già formattato per il PDF cliente. */
export function mappaSimulazionePerPdf(sim: RisultatoSimulazioneFv): {
  dettagliImpianto: DettagliImpiantoPdf
  condizioniEconomiche: CondizioniEconomichePdf
  simulazione: SimulazionePdf
} {
  const wp = sim.wattPicco
  const composizione =
    sim.moduli > 0 && wp != null
      ? `${sim.moduli} moduli da ${wp} Wp`
      : sim.moduli > 0
        ? `${sim.moduli} moduli fotovoltaici`
        : 'Impianto fotovoltaico'

  const agevolazioni = sim.agevolazioni
  const investimentoCents = agevolazioni.investimentoLordoCents
  const eco = sim.economia

  const partiDetrazione = [
    sim.detrazione.detrazioneTotaleCents > 0
      ? `FV ${sim.detrazione.detrazionePct.toLocaleString('it-IT')}%`
      : null,
    sim.detrazioneTermico && sim.detrazioneTermico.detrazioneTotaleCents > 0
      ? `termico ${sim.detrazioneTermico.detrazionePct.toLocaleString('it-IT')}%`
      : null,
  ].filter((x): x is string => !!x)
  const detrazioneEtichetta =
    partiDetrazione.length > 0
      ? `Detrazione fiscale (${partiDetrazione.join(' + ')})`
      : 'Detrazione fiscale'

  const dettagliImpianto: DettagliImpiantoPdf = {
    composizione,
    potenzaKwp: `${sim.kWp.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp`,
    produzioneKwh: kwh(sim.produzioneKwh),
    resaSpecifica:
      sim.resaSpecificaKwhKwp != null
        ? `${sim.resaSpecificaKwhKwp.toLocaleString('it-IT')} kWh/kWp·anno`
        : null,
    consumoKwh: sim.consumoKwh > 0 ? kwh(sim.consumoKwh) : null,
    falde: sim.falde
      .filter((f) => f.moduli > 0)
      .map((f) => ({
        etichetta: `Falda ${f.indice + 1} · ${f.moduli} moduli · ${f.kWp.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp`,
        inclinazione: `${f.pitchDegrees.toLocaleString('it-IT', { maximumFractionDigits: 1 })}°`,
        esposizione: `${f.azimuthDegrees.toLocaleString('it-IT', { maximumFractionDigits: 0 })}°`,
        area:
          f.areaMeters2 != null
            ? `${f.areaMeters2.toLocaleString('it-IT', { maximumFractionDigits: 1 })} m²`
            : null,
      })),
    regimeRid: `Cessione dell’energia immessa valorizzata a ${sim.tariffaExportEurKwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh (ipotesi RID dello studio).`,
    detrazioneSintesi:
      agevolazioni.detrazioneTotaleCents > 0
        ? `${detrazioneEtichetta}: ${euroCents(agevolazioni.detrazioneTotaleCents)} complessivi nel piano economico.${agevolazioni.contoTermicoTotaleCents > 0 ? ` Il blocco termico usa in alternativa il Conto Termico (${euroCents(agevolazioni.contoTermicoTotaleCents)}).` : ''}`
        : agevolazioni.contoTermicoTotaleCents > 0
          ? `Conto Termico sul blocco termico: ${euroCents(agevolazioni.contoTermicoTotaleCents)}. Nessuna detrazione fiscale è sommata sulle stesse spese.`
          : 'Nessuna agevolazione fiscale inclusa nella simulazione.',
    moduli: sim.moduli,
    kWpNumero: sim.kWp,
    produzioneKwhNumero: sim.produzioneKwh,
    wattPicco: wp ?? null,
  }

  const condizioniEconomiche: CondizioniEconomichePdf = {
    totaleLordo: euroCents(investimentoCents),
    detrazioneEtichetta,
    detrazioneImporto:
      agevolazioni.detrazioneTotaleCents > 0
        ? euroCents(agevolazioni.detrazioneTotaleCents)
        : null,
    contoTermicoImporto:
      agevolazioni.contoTermicoTotaleCents > 0
        ? euroCents(agevolazioni.contoTermicoTotaleCents)
        : null,
    nettoIndicativo: euroCents(agevolazioni.investimentoEffettivoCents),
    bollettaAttualeMensile: euroCents(eco.bollettaAttualeMensileCents),
    bollettaConFvMensile: euroCents(eco.bollettaConFvMensileCents),
    creditoMensile:
      eco.creditoMensileCents > 0 ? euroCents(eco.creditoMensileCents) : null,
    risparmioMensile: euroCents(eco.risparmioMensileCents),
    risparmioAnnuo: euroCents(eco.beneficioAnnuoAnno1Cents),
    paybackAnni:
      eco.paybackAnni != null
        ? `${eco.paybackAnni.toLocaleString('it-IT')} anni`
        : null,
    notePagamento: `Acconto ${TERMINI_PAGAMENTO.acconto}. ${TERMINI_PAGAMENTO.saldo}. Offerta valida ${TERMINI_PAGAMENTO.validitaGiorniLavorativi} giorni lavorativi, salvo diversa indicazione. Risparmio e detrazione IRPEF sono stime dallo studio tetto: non costituiscono quotazione fiscale né certificazione di producibilità.`,
  }

  /*
   * La curva cumulata: parte dall'investimento in negativo e attraversa lo zero
   * nell'anno del rientro. È il grafico che risponde alla domanda che il
   * cliente si sta davvero facendo, e per costruirlo serve tutto l'orizzonte,
   * non i primi dodici anni.
   */
  const cumulato: PuntoCumulatoPdf[] = []
  let saldoCents = -investimentoCents
  for (const anno of eco.cashflow) {
    saldoCents += anno.flussoCents
    cumulato.push({ anno: anno.anno, cumulatoEur: saldoCents / 100 })
  }

  const ind = calcolaIndicatori({
    produzioneAnnuaKwh: sim.produzioneKwh,
    potenzaKwp: sim.kWp,
    potenzaCaKw: sim.potenzaCaKw ?? null,
    irraggiamentoPianoKwhM2: null,
  })

  /*
   * Le metriche della scheda tecnica. Sono quelle del dossier di riferimento
   * più l'autoconsumo con accumulo, che loro non hanno perché non vendono
   * batterie. Quelle non calcolabili si omettono invece di mostrare un
   * trattino: una riga vuota su una scheda tecnica toglie credibilità a tutte
   * le altre.
   */
  const indicatori: IndicatorePdf[] = [
    { icona: 'potenza', etichetta: 'Potenza CC installata', valore: sim.kWp.toLocaleString('it-IT', { maximumFractionDigits: 2 }), unita: 'kWp' },
    ...(sim.potenzaCaKw
      ? [{ icona: 'inverter', etichetta: 'Potenza massima CA', valore: sim.potenzaCaKw.toLocaleString('it-IT', { maximumFractionDigits: 2 }), unita: 'kW' }]
      : []),
    { icona: 'produzione', etichetta: 'Produzione solare annua', valore: sim.produzioneKwh.toLocaleString('it-IT'), unita: 'kWh' },
    { icona: 'co2', etichetta: 'Emissioni CO2 evitate', valore: ind.co2EvitataTonnellate.toLocaleString('it-IT', { maximumFractionDigits: 2 }), unita: 't/anno' },
    { icona: 'albero', etichetta: 'Alberi equivalenti', valore: ind.alberiEquivalenti.toLocaleString('it-IT'), unita: '' },
    ...(ind.sovradimensionamentoPct
      ? [{ icona: 'rapporto', etichetta: 'Sovradimensionamento CC/CA', valore: Math.round(ind.sovradimensionamentoPct).toLocaleString('it-IT'), unita: '%' }]
      : []),
    ...(sim.resaSpecificaKwhKwp != null
      ? [{ icona: 'calendario', etichetta: 'Produzione specifica annua', valore: Math.round(sim.resaSpecificaKwhKwp).toLocaleString('it-IT'), unita: 'kWh/kWp' }]
      : []),
    ...(sim.accumulo
      ? [
          {
            icona: 'batteria',
            etichetta: 'Autoconsumo con accumulo',
            valore: Math.round(
              sim.accumulo.frazioneAutoconsumoConAccumulo * 100,
            ).toLocaleString('it-IT'),
            unita: '%',
          },
          {
            icona: 'casa',
            etichetta: 'Energia recuperata dalla batteria',
            valore: sim.accumulo.energiaRecuperataKwh.toLocaleString('it-IT'),
            unita: 'kWh/anno',
          },
          {
            icona: 'calendario',
            etichetta: 'Utilizzo annuo dell’accumulo',
            valore: Math.round(
              sim.accumulo.cicliEquivalentiAnno,
            ).toLocaleString('it-IT'),
            unita: 'cicli eq.',
          },
        ]
      : []),
  ]

  const tir = tassoInternoRendimento([
    -investimentoCents,
    ...eco.cashflow.map((a) => a.flussoCents),
  ])
  const lcoe = costoLivellatoEnergiaEurKwh({
    investimentoNettoCents: agevolazioni.investimentoFvEffettivoCents,
    produzioneAnnuaKwh: sim.produzioneKwh,
    orizzonteAnni: eco.cashflow.length,
    tassoScontoPct: sim.parametriEconomici.tassoScontoPct,
    degradazionePctAnno:
      sim.parametriEconomici.degradazioneProduzionePctAnno,
  })

  const kpiFinanziari: KpiFinanziarioPdf[] = [
    { etichetta: 'Costo effettivo stimato', valore: euroCents(agevolazioni.investimentoEffettivoCents), tono: 'costo' },
    { etichetta: 'Valore attuale netto (VAN)', valore: euroCents(eco.npvCents), tono: eco.npvCents >= 0 ? 'beneficio' : 'costo' },
    ...(eco.paybackAnni != null
      ? [{ etichetta: 'Rientro dell’investimento', valore: `${eco.paybackAnni.toLocaleString('it-IT')} anni`, tono: 'neutro' as const }]
      : []),
    ...(tir != null
      ? [{ etichetta: 'Tasso interno (TIR)', valore: `${(tir * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })} %`, tono: 'neutro' as const }]
      : []),
    ...(lcoe != null
      ? [{ etichetta: 'Costo dell’energia', valore: `${lcoe.toLocaleString('it-IT', { maximumFractionDigits: 3 })} €/kWh`, tono: 'beneficio' as const }]
      : []),
  ]

  const b = sim.bilancio
  const simulazione: SimulazionePdf = {
    tariffe: `Prelievo ${sim.tariffaImportEurKwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh · cessione ${sim.tariffaExportEurKwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh · autoconsumo ${(sim.frazioneAutoconsumoEffettiva * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}% della produzione`,
    flussi: {
      produzione: kwh(b.produzioneKwh),
      autoconsumo: kwh(b.autoconsumoKwh),
      exportRete: kwh(b.exportKwh),
      daRete: kwh(b.daReteKwh),
    },
    flussiNum: {
      produzione: b.produzioneKwh,
      autoconsumo: b.autoconsumoKwh,
      exportRete: b.exportKwh,
      daRete: b.daReteKwh,
      consumo: b.consumoKwh,
    },
    produzioneMensileKwh: distribuisciProduzioneMensile(sim.produzioneKwh),
    npv: euroCents(eco.npvCents),
    npvCents: eco.npvCents,
    paybackAnni: condizioniEconomiche.paybackAnni,
    cashflow: eco.cashflow.map((r) => ({
      anno: String(r.anno),
      risparmio: euroCents(r.risparmioEnergiaCents),
      risparmioTermico:
        r.risparmioTermicoCents !== 0 ? euroCents(r.risparmioTermicoCents) : null,
      detrazione: euroCents(r.rataDetrazioneCents),
      contoTermico:
        r.rataContoTermicoCents !== 0 ? euroCents(r.rataContoTermicoCents) : null,
      flusso: euroCents(r.flussoCents),
      flussoCents: r.flussoCents,
    })),
    cumulato,
    indicatori,
    kpiFinanziari,
    termico: sim.termico
      ? {
          gasEvitatoSmc: `${sim.termico.gasEvitatoSmc.toLocaleString('it-IT')} Smc`,
          costoGasEvitato: euroCents(sim.termico.costoGasEvitatoCents),
          consumoElettricoAggiuntivo: kwh(sim.termico.consumoElettricoAnnuoKwh),
          costoElettricoAggiuntivo: euroCents(sim.termico.costoElettricoAggiuntivoCents),
          risparmioAnnuo: euroCents(sim.termico.risparmioAnnuoCents),
          incentivoEtichetta:
            agevolazioni.incentivoTermico === 'conto_termico'
              ? 'Conto Termico 3.0 - contributo a fondo perduto'
              : agevolazioni.incentivoTermico === 'detrazione'
                ? `Detrazione fiscale termica ${sim.detrazioneTermico?.detrazionePct.toLocaleString('it-IT') ?? ''}%`
                : 'Nessuna agevolazione termica inclusa',
          incentivoImporto:
            agevolazioni.incentivoTermico === 'conto_termico' &&
            agevolazioni.contoTermicoTotaleCents > 0
              ? euroCents(agevolazioni.contoTermicoTotaleCents)
              : agevolazioni.incentivoTermico === 'detrazione' &&
                  sim.detrazioneTermico
                ? euroCents(sim.detrazioneTermico.detrazioneTotaleCents)
                : null,
          notaIncentivo:
            agevolazioni.incentivoTermico === 'conto_termico'
              ? 'Il Conto Termico e la detrazione fiscale non sono sommati sulle stesse spese: il piano usa soltanto il contributo selezionato.'
              : agevolazioni.incentivoTermico === 'detrazione'
                ? 'Il piano usa la detrazione termica selezionata e non aggiunge il Conto Termico sulle stesse spese.'
                : 'Il piano non attribuisce agevolazioni al blocco termico.',
        }
      : null,
    orizzonteAnni: eco.cashflow.length,
  }

  return { dettagliImpianto, condizioniEconomiche, simulazione }
}
