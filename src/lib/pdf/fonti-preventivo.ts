import { existsSync } from 'node:fs'
import path from 'node:path'
import { Font } from '@react-pdf/renderer'

/**
 * Tipografia del dossier cliente.
 * Cormorant Garamond (display) + DM Sans (testo) — OFL in public/brand/fonts.
 * TTF statici: woff2/variable fonts rompono il subsetting di fontkit.
 */
export const FONT_DISPLAY = 'CormorantGaramond'
export const FONT_CORPO = 'DMSans'

const FILE_FONT = [
  'CormorantGaramond-Regular.ttf',
  'CormorantGaramond-SemiBold.ttf',
  'CormorantGaramond-Bold.ttf',
  'DMSans-Regular.ttf',
  'DMSans-Medium.ttf',
  'DMSans-Bold.ttf',
] as const

let registrati = false

export function registraFontiPreventivo(): void {
  if (registrati) return
  const dir = path.join(process.cwd(), 'public/brand/fonts')
  const mancanti = FILE_FONT.filter((f) => !existsSync(path.join(dir, f)))
  if (mancanti.length > 0) {
    throw new Error(
      `Font dossier PDF mancanti in public/brand/fonts: ${mancanti.join(', ')}. ` +
        'Versionare i TTF OFL nel repository.',
    )
  }

  Font.register({
    family: FONT_DISPLAY,
    fonts: [
      {
        src: path.join(dir, 'CormorantGaramond-Regular.ttf'),
        fontWeight: 400,
      },
      {
        src: path.join(dir, 'CormorantGaramond-SemiBold.ttf'),
        fontWeight: 600,
      },
      {
        src: path.join(dir, 'CormorantGaramond-Bold.ttf'),
        fontWeight: 700,
      },
    ],
  })

  Font.register({
    family: FONT_CORPO,
    fonts: [
      { src: path.join(dir, 'DMSans-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dir, 'DMSans-Medium.ttf'), fontWeight: 500 },
      { src: path.join(dir, 'DMSans-Bold.ttf'), fontWeight: 700 },
    ],
  })

  Font.registerHyphenationCallback((word) => [word])

  registrati = true
}
