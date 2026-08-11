import { formattaImporto } from '@/lib/domain/money'
import type { RisultatoSimulazioneFv } from '@/lib/domain/simulazione-fv'
import type {
  CondizioniEconomichePdf,
  DettagliImpiantoPdf,
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

  const investimentoCents =
    sim.detrazione.detrazioneTotaleCents + sim.detrazione.prezzoNettoIndicativoCents
  const eco = sim.economia

  const dettagliImpianto: DettagliImpiantoPdf = {
    composizione,
    potenzaKwp: `${sim.kWp.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kWp`,
    produzioneKwh: kwh(sim.produzioneKwh),
    resaSpecifica:
      sim.resaSpecificaKwhKwp != null
        ? `${sim.resaSpecificaKwhKwp.toLocaleString('it-IT')} kWh/kWp·anno`
        : null,
    consumoKwh: sim.consumoKwh > 0 ? kwh(sim.consumoKwh) : null,
    // Solo falde con moduli: allineato a planimetria / ortofoto.
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
    detrazioneSintesi: `Detrazione IRPEF ${sim.detrazione.detrazionePct.toLocaleString('it-IT')}% sul prezzo IVA inclusa (${euroCents(sim.detrazione.detrazioneTotaleCents)}), ripartita in ${sim.detrazione.anniRate} anni nel piano economico.`,
  }

  const condizioniEconomiche: CondizioniEconomichePdf = {
    totaleLordo: euroCents(investimentoCents),
    detrazionePct: `${sim.detrazione.detrazionePct.toLocaleString('it-IT')}%`,
    detrazioneImporto: euroCents(sim.detrazione.detrazioneTotaleCents),
    nettoIndicativo: euroCents(sim.detrazione.prezzoNettoIndicativoCents),
    bollettaAttualeMensile: euroCents(eco.bollettaAttualeMensileCents),
    bollettaConFvMensile: euroCents(eco.bollettaConFvMensileCents),
    risparmioMensile: euroCents(eco.risparmioMensileCents),
    risparmioAnnuo: euroCents(eco.risparmioAnnuoAnno1Cents),
    paybackAnni:
      eco.paybackAnni != null
        ? `${eco.paybackAnni.toLocaleString('it-IT')} anni`
        : null,
    notePagamento:
      'Modalità di pagamento e tempi di validità della proposta sono indicati in sede di accettazione. Risparmio, detrazione IRPEF, ritorno dell’investimento e bollette sono stime indicative dallo studio tetto e dalla configurazione vigente: non costituiscono quotazione fiscale, bancaria né certificazione di producibilità.',
  }

  const simulazione: SimulazionePdf = {
    tariffe: `Prelievo ${sim.tariffaImportEurKwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh · cessione ${sim.tariffaExportEurKwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €/kWh · autoconsumo ${(sim.frazioneAutoconsumoUsata * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}% della produzione`,
    flussi: {
      produzione: kwh(sim.bilancio.produzioneKwh),
      autoconsumo: kwh(sim.bilancio.autoconsumoKwh),
      exportRete: kwh(sim.bilancio.exportKwh),
      daRete: kwh(sim.bilancio.daReteKwh),
    },
    npv: euroCents(eco.npvCents),
    paybackAnni: condizioniEconomiche.paybackAnni,
    cashflow: eco.cashflow.slice(0, 12).map((r) => ({
      anno: String(r.anno),
      risparmio: euroCents(r.risparmioEnergiaCents),
      detrazione: euroCents(r.rataDetrazioneCents),
      flusso: euroCents(r.flussoCents),
    })),
    orizzonteAnni: eco.cashflow.length,
  }

  return { dettagliImpianto, condizioniEconomiche, simulazione }
}
