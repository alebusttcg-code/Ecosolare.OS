/**
 * Innesto del motore fisico nello studio tetto (ADR-016, tappa 7b).
 *
 * Lo studio, nel laboratorio, calcola la produzione con la formula calibrata e
 * la salva. Qui si offre l'alternativa: la stessa produzione dal **motore
 * fisico**, dalle falde reali dello studio e dalla climatologia del sito. Il
 * mapping falde→motore è puro e testabile; il calcolo è asincrono perché la
 * climatologia si legge (una volta) dalla cache.
 *
 * L'innesto è **dietro un interruttore** e con ripiego: quando il motore non può
 * stimare — mancano falde o coordinate — restituisce `null`, e il chiamante tiene
 * il numero esistente invece di inventarne uno.
 */

import {
  getClimatologia,
  type ArchivioClimatologia,
  type OpzioniPvgis,
} from '@/lib/solar/clima'
import {
  calcolaProduzioneOraria,
  type FaldaFv,
} from '@/lib/domain/produzione-oraria'
import {
  PARAMETRI_FISICI_PREDEFINITI,
  sistemaDaParametri,
  type ParametriFisici,
} from '@/lib/domain/parametri-fisici'
import {
  kWpDaLayout,
  layoutsAttivi,
  type SnapshotStudioTetto,
} from '@/lib/domain/studio-tetto'

type SnapshotGeometria = Pick<
  SnapshotStudioTetto,
  'analisi' | 'layouts' | 'layout' | 'faldeRimosse'
>

export interface FaldeStudio {
  readonly falde: FaldaFv[]
  readonly lat: number | null
  readonly lng: number | null
}

/**
 * Le falde del motore fisico dallo snapshot: inclinazione ed esposizione
 * dall'analisi del tetto, potenza dai layout dei moduli. Salta le falde rimosse,
 * quelle senza moduli e quelle non più nell'analisi — le stesse regole che usa
 * la formula attuale, così i due motori guardano lo stesso impianto.
 */
export function faldeDalloSnapshot(snapshot: SnapshotGeometria): FaldeStudio {
  const layouts = layoutsAttivi(snapshot)
  const falde = (snapshot.analisi.falde ?? []).filter(
    (f) => !snapshot.faldeRimosse.includes(f.indice),
  )

  let lat = snapshot.analisi.location?.latitude ?? null
  let lng = snapshot.analisi.location?.longitude ?? null

  const out: FaldaFv[] = []
  for (const layout of layouts) {
    const kWp = kWpDaLayout(layout)
    if (kWp <= 0) continue
    const falda = falde.find((f) => f.indice === layout.faldaIndice)
    if (!falda) continue
    out.push({
      kWp,
      tiltDeg: falda.pitchDegrees,
      azimutDeg: falda.azimuthDegrees,
    })
    if (lat == null && falda.center) {
      lat = falda.center.latitude
      lng = falda.center.longitude
    }
  }

  return { falde: out, lat, lng }
}

export interface OpzioniProduzioneFisica extends OpzioniPvgis {
  readonly archivio: ArchivioClimatologia
  readonly parametri?: ParametriFisici
}

/**
 * Produzione annua dello studio col motore fisico, o `null` se non stimabile
 * (niente falde, niente coordinate).
 *
 * In fase di studio l'inverter non è ancora scelto — è del preventivo — quindi
 * la potenza CA si mette generosa e il clipping (trascurabile su questi impianti)
 * non entra nella stima. Lo aggiungerà il preventivo con l'inverter vero.
 */
export async function produzioneFisicaDaStudio(
  snapshot: SnapshotGeometria,
  opzioni: OpzioniProduzioneFisica,
): Promise<number | null> {
  const { falde, lat, lng } = faldeDalloSnapshot(snapshot)
  if (falde.length === 0 || lat == null || lng == null) return null

  const clima = await getClimatologia(lat, lng, opzioni)
  const parametri = opzioni.parametri ?? PARAMETRI_FISICI_PREDEFINITI
  const kWpTotale = falde.reduce((s, f) => s + f.kWp, 0)
  const sistema = sistemaDaParametri(kWpTotale * 10, parametri)

  return calcolaProduzioneOraria(clima, falde, sistema).produzioneAnnuaKwh
}
