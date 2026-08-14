/**
 * Validazione dal vivo del motore fisico (ADR-016, tappe 2–3).
 *
 *   npm run prova:pvgis
 *
 * Scarica la climatologia reale dei tre tetti dei dossier, ci fa girare il
 * motore fisico completo (posizione solare → trasposizione → temperatura →
 * perdite → inverter) e **triangola** con SolarEdge: due fisiche indipendenti a
 * confronto, non una tarata sull'altra. Non tocca il database, solo rete PVGIS.
 */
import { riduciTmyAClimatologia, scaricaTmyPvgis } from '../src/lib/solar/clima'
import {
  calcolaProduzioneOraria,
  type FaldaFv,
  type SistemaFv,
} from '../src/lib/domain/produzione-oraria'
import {
  PARAMETRI_FISICI_PREDEFINITI,
  sistemaDaParametri,
} from '../src/lib/domain/parametri-fisici'

type Caso = {
  nome: string
  lat: number
  lng: number
  falde: FaldaFv[]
  sistema: SistemaFv
  /** Riferimenti SolarEdge dai dossier consegnati. */
  se: { produzioneKwh: number; resaKwhKwp: number; prPct: number }
}

// Moduli Viessmann Vitovolt 300-DG: bifacciali (doppio vetro). Parametri fisici
// predefiniti (dalla configurazione, qui i default) per tutti — nessuna taratura.
const sistema = (potenzaAcMaxKw: number): SistemaFv =>
  sistemaDaParametri(potenzaAcMaxKw, PARAMETRI_FISICI_PREDEFINITI)

const CASI: Caso[] = [
  {
    nome: 'Riboldi (Carrara)',
    lat: 44.08,
    lng: 10.1,
    falde: [{ kWp: 6, tiltDeg: 4, azimutDeg: 174 }],
    sistema: sistema(5),
    se: { produzioneKwh: 8066, resaKwhKwp: 1344, prPct: 92 },
  },
  {
    nome: 'Ricci (Sarzana)',
    lat: 44.11,
    lng: 9.96,
    falde: [{ kWp: 6, tiltDeg: 8, azimutDeg: 203 }],
    sistema: sistema(5),
    se: { produzioneKwh: 7960, resaKwhKwp: 1327, prPct: 89 },
  },
  {
    nome: 'Tarantola (Ceparana)',
    lat: 44.16,
    lng: 9.83,
    falde: [
      { kWp: 3, tiltDeg: 7, azimutDeg: 239 },
      { kWp: 1, tiltDeg: 17, azimutDeg: 239 },
    ],
    sistema: sistema(3),
    se: { produzioneKwh: 5235, resaKwhKwp: 1309, prPct: 89 },
  },
]

function scarto(nostro: number, riferimento: number): string {
  const pct = ((nostro - riferimento) / riferimento) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

async function main() {
  console.log('Motore fisico EcoSolare vs SolarEdge — triangolazione via PVGIS\n')
  for (const caso of CASI) {
    const tmy = await scaricaTmyPvgis(caso.lat, caso.lng)
    const clima = riduciTmyAClimatologia(tmy.outputs.tmy_hourly, {
      lat: caso.lat,
      lng: caso.lng,
      elevazioneM: tmy.inputs?.location?.elevation ?? null,
    })
    const p = calcolaProduzioneOraria(clima, caso.falde, caso.sistema)

    console.log(`### ${caso.nome}  (GHI ${clima.ghiAnnuoKwhM2} kWh/m²)`)
    console.log(
      `  Produzione:  motore ${p.produzioneAnnuaKwh} kWh  |  SolarEdge ${caso.se.produzioneKwh} kWh  |  scarto ${scarto(p.produzioneAnnuaKwh, caso.se.produzioneKwh)}`,
    )
    console.log(
      `  Resa spec.:  motore ${p.resaSpecificaKwhKwp} kWh/kWp  |  SolarEdge ${caso.se.resaKwhKwp}  |  scarto ${scarto(p.resaSpecificaKwhKwp, caso.se.resaKwhKwp)}`,
    )
    console.log(
      `  PR:          motore ${(p.performanceRatio * 100).toFixed(0)}%  |  SolarEdge ${caso.se.prPct}%     Clipping: ${p.clippingPct.toFixed(2)}%`,
    )
    console.log('')
  }
  console.log(
    'Parametri di sistema identici per tutti (bifacciale +6%, albedo 0,2, perdite standard):',
  )
  console.log('nessuna taratura per caso. Gli scarti sono il residuo di due fisiche indipendenti.')
}

main().catch((e) => {
  console.error('Errore:', e instanceof Error ? e.message : e)
  process.exit(1)
})
