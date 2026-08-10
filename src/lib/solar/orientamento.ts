/**
 * Etichetta compass da azimuth Solar (0 = Nord, 90 = Est, 180 = Sud).
 */
export function etichettaAzimuth(gradi: number): string {
  const normalizzato = ((gradi % 360) + 360) % 360
  const settori = [
    'N',
    'NE',
    'E',
    'SE',
    'S',
    'SO',
    'O',
    'NO',
  ] as const
  const indice = Math.round(normalizzato / 45) % 8
  return settori[indice]!
}
