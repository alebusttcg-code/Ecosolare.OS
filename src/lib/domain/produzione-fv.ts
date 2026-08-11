/**
 * Stima di producibilità FV sito-specifica (motore interno EcoSolare).
 *
 * Non replica SolarEdge Designer: usa latitudine, inclinazione, esposizione e
 * (se disponibile) irraggiamento relativo Solar per differenziare i casi
 * cliente. La resa non è più una costante unica.
 */

export type InputProduzioneFalda = {
  readonly kWp: number
  readonly latitudine: number
  readonly pitchDegrees: number
  readonly azimuthDegrees: number
  /** Media sunshine della falda (quantili Solar), se nota. */
  readonly sunshineMedio?: number | null
  /** Media sunshine delle falde del tetto, per normalizzare. */
  readonly sunshineMedioTetto?: number | null
}

export type RisultatoProduzioneFalda = {
  readonly produzioneKwh: number
  readonly resaSpecificaKwhKwp: number
  readonly resaBaseKwhKwp: number
  readonly fattoreAzimut: number
  readonly fattoreTilt: number
  readonly fattoreSunshine: number
}

/**
 * Resa specifica di riferimento (kWh/kWp·anno) da latitudine in Italia.
 * Ancorata empiricamente ai dossier (~1300–1450 nel centro-nord).
 */
export function resaBaseDaLatitudine(latitudine: number): number {
  const lat = Math.min(47.5, Math.max(36.5, latitudine))
  // 45°N ≈ 1285; 41°N ≈ 1420; 38°N ≈ 1520
  return Math.round(2860 - lat * 35)
}

/** 1.0 a sud (180°), cala verso est/ovest/nord. */
export function fattoreAzimut(azimuthDegrees: number): number {
  const az = ((azimuthDegrees % 360) + 360) % 360
  const delta = Math.min(Math.abs(az - 180), 360 - Math.abs(az - 180))
  return 0.58 + 0.42 * Math.cos((delta * Math.PI) / 180)
}

/** Ottimale ~ lat−15° (tipico Italia); tetti piatti o molto ripidi perdono. */
export function fattoreTilt(pitchDegrees: number, latitudine: number): number {
  const ottimale = Math.min(38, Math.max(22, latitudine - 15))
  const pitch = Math.min(60, Math.max(0, pitchDegrees))
  const diff = Math.abs(pitch - ottimale)
  return Math.max(0.75, 1 - diff * 0.007)
}

/**
 * Fattore relativo tra falde dello stesso tetto. Neutro se i dati mancano.
 */
export function fattoreSunshineRelativo(
  sunshineMedio: number | null | undefined,
  sunshineMedioTetto: number | null | undefined,
): number {
  if (
    sunshineMedio == null ||
    sunshineMedioTetto == null ||
    !(sunshineMedioTetto > 0) ||
    !(sunshineMedio > 0)
  ) {
    return 1
  }
  const grezzo = sunshineMedio / sunshineMedioTetto
  return Math.min(1.12, Math.max(0.88, grezzo))
}

export function stimaProduzioneFalda(
  input: InputProduzioneFalda,
): RisultatoProduzioneFalda {
  if (!(input.kWp > 0) || !Number.isFinite(input.latitudine)) {
    return {
      produzioneKwh: 0,
      resaSpecificaKwhKwp: 0,
      resaBaseKwhKwp: 0,
      fattoreAzimut: 0,
      fattoreTilt: 0,
      fattoreSunshine: 1,
    }
  }

  const resaBaseKwhKwp = resaBaseDaLatitudine(input.latitudine)
  const fa = fattoreAzimut(input.azimuthDegrees)
  const ft = fattoreTilt(input.pitchDegrees, input.latitudine)
  const fs = fattoreSunshineRelativo(
    input.sunshineMedio,
    input.sunshineMedioTetto,
  )
  const resaSpecificaKwhKwp = Math.round(resaBaseKwhKwp * fa * ft * fs)
  const produzioneKwh = Math.round(input.kWp * resaSpecificaKwhKwp)

  return {
    produzioneKwh,
    resaSpecificaKwhKwp,
    resaBaseKwhKwp,
    fattoreAzimut: fa,
    fattoreTilt: ft,
    fattoreSunshine: fs,
  }
}

/**
 * Pesi stagionali relativi (Italia centro-nord) per ripartire un totale annuo
 * in 12 mesi. Non sono tariffe né valori normativi: solo forma del profilo.
 * Somma = 1.
 */
export const PESI_MENSILI_FV_ITALIA: readonly number[] = [
  0.041, 0.051, 0.082, 0.092, 0.112, 0.122, 0.133, 0.112, 0.092, 0.071, 0.051,
  0.041,
]

/** Giorni per mese, anno non bisestile: serve ai modelli mese per mese. */
export const GIORNI_MESE: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
]

export const ETICHETTE_MESI_IT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
] as const

/** Ripartisce kWh annui sui 12 mesi; l’ultimo mese assorbe l’arrotondamento. */
export function distribuisciProduzioneMensile(
  produzioneAnnuakWh: number,
): number[] {
  if (!(produzioneAnnuakWh > 0) || !Number.isFinite(produzioneAnnuakWh)) {
    return Array.from({ length: 12 }, () => 0)
  }
  const out: number[] = []
  let somma = 0
  for (let i = 0; i < 11; i++) {
    const v = Math.round(produzioneAnnuakWh * PESI_MENSILI_FV_ITALIA[i]!)
    out.push(v)
    somma += v
  }
  out.push(Math.max(0, Math.round(produzioneAnnuakWh) - somma))
  return out
}
