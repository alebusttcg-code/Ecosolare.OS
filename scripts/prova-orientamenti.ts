/**
 * Validazione della trasposizione fuori dal quadrante sud (ADR-016, tappa 6).
 *
 *   npm run prova:orientamenti
 *
 * È la prova che il motore fisico fa ciò che la vecchia formula calibrata non
 * poteva: dare numeri giusti su un tetto a est, a ovest, a nord. Il riferimento
 * non è SolarEdge (di quei tetti non ci sono dossier) ma **PVGIS PVcalc**, un
 * motore fisico indipendente. Si confronta la *curva di risposta
 * all'orientamento*: la resa a ogni azimut, normalizzata a sud. Se le due curve
 * si sovrappongono, la nostra trasposizione è corretta a ogni esposizione.
 *
 * Convenzioni azimut: PVGIS `aspect` (0=sud, −90=est, +90=ovest, 180=nord);
 * il nostro motore usa l'azimut da Nord (180=sud) = 180 + aspect.
 */
import { riduciTmyAClimatologia, scaricaTmyPvgis } from '../src/lib/solar/clima'
import { calcolaProduzioneOraria } from '../src/lib/domain/produzione-oraria'

const SITO = { nome: 'Sarzana', lat: 44.11, lng: 9.96 }
const TILT = 30
const PERDITA_PVGIS = 14 // % "altre perdite" di PVcalc, ~pari alle nostre + inverter

const ESPOSIZIONI: { nome: string; aspect: number }[] = [
  { nome: 'Sud', aspect: 0 },
  { nome: 'Sud-Est', aspect: -45 },
  { nome: 'Est', aspect: -90 },
  { nome: 'Ovest', aspect: 90 },
  { nome: 'Sud-Ovest', aspect: 45 },
  { nome: 'Nord-Est', aspect: -135 },
  { nome: 'Nord', aspect: 180 },
]

async function pvcalcEy(lat: number, lng: number, angle: number, aspect: number): Promise<number> {
  const url =
    `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lng}` +
    `&peakpower=1&loss=${PERDITA_PVGIS}&angle=${angle}&aspect=${aspect}` +
    `&outputformat=json&mountingplace=building&pvtechchoice=crystSi`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`PVcalc ${r.status} (aspect ${aspect})`)
  const d = (await r.json()) as { outputs: { totals: { fixed: { E_y: number } } } }
  return d.outputs.totals.fixed.E_y
}

async function main() {
  const tmy = await scaricaTmyPvgis(SITO.lat, SITO.lng)
  const clima = riduciTmyAClimatologia(tmy.outputs.tmy_hourly, {
    lat: SITO.lat,
    lng: SITO.lng,
    elevazioneM: tmy.inputs?.location?.elevation ?? null,
  })

  console.log(`Curva di risposta all'orientamento — ${SITO.nome}, ${TILT}° — motore vs PVGIS PVcalc`)
  console.log('(monofacciale, per confronto pulito col crystSi di PVGIS)\n')
  console.log('Esposizione   Motore   PVGIS   scarto |  rel.sud Motore  PVGIS   Δ')

  const righe: { nome: string; nostro: number; pvgis: number }[] = []
  for (const e of ESPOSIZIONI) {
    // Monofacciale (bifacciale 0) per confrontarsi col crystSi di PVGIS.
    const p = calcolaProduzioneOraria(
      clima,
      [{ kWp: 1, tiltDeg: TILT, azimutDeg: (180 + e.aspect + 360) % 360 }],
      { potenzaAcMaxKw: 100, guadagnoBifaccialePct: 0 },
    )
    const pvgis = Math.round(await pvcalcEy(SITO.lat, SITO.lng, TILT, e.aspect))
    righe.push({ nome: e.nome, nostro: p.resaSpecificaKwhKwp, pvgis })
  }

  const sudNostro = righe[0]!.nostro
  const sudPvgis = righe[0]!.pvgis
  for (const r of righe) {
    const scarto = ((r.nostro - r.pvgis) / r.pvgis) * 100
    const relNostro = r.nostro / sudNostro
    const relPvgis = r.pvgis / sudPvgis
    const deltaRel = (relNostro - relPvgis) * 100
    console.log(
      `${r.nome.padEnd(12)} ${String(r.nostro).padStart(6)}  ${String(r.pvgis).padStart(6)}  ${scarto >= 0 ? '+' : ''}${scarto.toFixed(1)}%`.padEnd(40) +
        `|  ${relNostro.toFixed(2)}      ${relPvgis.toFixed(2)}   ${deltaRel >= 0 ? '+' : ''}${deltaRel.toFixed(1)}pt`,
    )
  }
  console.log(
    '\nLa colonna che conta è «rel.sud»: la forma della curva. Se Δ è piccolo su est/ovest/nord,',
  )
  console.log('la trasposizione generalizza — proprio dove la vecchia formula calibrata non arrivava.')
}

main().catch((e) => {
  console.error('Errore:', e instanceof Error ? e.message : e)
  process.exit(1)
})
