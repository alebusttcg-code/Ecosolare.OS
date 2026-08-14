/**
 * La porta d'ingresso del motore fisico: da un tetto al suo quadro energetico.
 *
 * I pezzi — climatologia, produzione oraria, profilo di carico, autoconsumo —
 * sono costruiti e validati ciascuno per conto suo. Questa funzione li compone
 * in un solo risultato: quanto produce l'impianto, quanto se ne autoconsuma,
 * quanto va in rete. È l'API che l'innesto nel preventivo (tappa 7) chiamerà,
 * ed è l'unico punto che tocca la rete — una volta, all'ingest della
 * climatologia, mai durante un preventivo.
 */

import {
  getClimatologia,
  type ArchivioClimatologia,
  type OpzioniPvgis,
} from '@/lib/solar/clima'
import {
  calcolaProduzioneOraria,
  type FaldaFv,
  type ProduzioneOraria,
  type SistemaFv,
} from '@/lib/domain/produzione-oraria'
import {
  autoconsumoDaMatching,
  matriceConsumoMensileOraria,
  type BilancioDaMatching,
  type ProfiloCarico,
} from '@/lib/domain/profili-carico'

export interface IngressoStimaSito {
  readonly lat: number
  readonly lng: number
  readonly falde: readonly FaldaFv[]
  readonly sistema: SistemaFv
  /** Consumo annuo dalla bolletta, kWh. */
  readonly consumoAnnuoKwh: number
  readonly profilo: ProfiloCarico
}

export interface StimaEnergeticaSito {
  readonly fonteClima: string
  readonly ghiAnnuoKwhM2: number
  readonly produzione: ProduzioneOraria
  readonly bilancio: BilancioDaMatching
}

export interface OpzioniStimaSito extends OpzioniPvgis {
  readonly archivio: ArchivioClimatologia
}

/**
 * Il quadro energetico di un tetto: produzione fisica + autoconsumo dal profilo.
 *
 * La climatologia arriva dalla cache (scaricata una volta per griglia); la
 * produzione dal motore fisico sulle falde reali; l'autoconsumo dal confronto
 * orario fra quella produzione e il consumo distribuito sul profilo di utenza.
 */
export async function stimaEnergeticaSito(
  input: IngressoStimaSito,
  opzioni: OpzioniStimaSito,
): Promise<StimaEnergeticaSito> {
  const clima = await getClimatologia(input.lat, input.lng, opzioni)

  const produzione = calcolaProduzioneOraria(clima, input.falde, input.sistema)

  const consumo = matriceConsumoMensileOraria(input.consumoAnnuoKwh, input.profilo)
  const bilancio = autoconsumoDaMatching(
    produzione.produzioneMensileOraria,
    consumo,
  )

  return {
    fonteClima: clima.fonte,
    ghiAnnuoKwhM2: clima.ghiAnnuoKwhM2,
    produzione,
    bilancio,
  }
}
