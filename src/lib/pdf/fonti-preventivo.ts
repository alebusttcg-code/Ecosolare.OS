import { existsSync } from 'node:fs'
import path from 'node:path'
import { Font } from '@react-pdf/renderer'

/** Tipografia editoriale prescritta dal brief commerciale. */
export const FONT_DISPLAY = 'BodoniModa'
export const FONT_DISPLAY_TEXT = 'BodoniModaText'
export const FONT_CORPO = 'Manrope'

const FILE_FONT = [
  'BodoniModa-Regular.ttf',
  'BodoniModa-Bold.ttf',
  'BodoniModa-Text.ttf',
  'Manrope-Regular.ttf',
  'Manrope-SemiBold.ttf',
  'Manrope-Bold.ttf',
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
        src: path.join(dir, 'BodoniModa-Regular.ttf'),
        fontWeight: 400,
      },
      {
        src: path.join(dir, 'BodoniModa-Bold.ttf'),
        fontWeight: 700,
      },
    ],
  })

  Font.register({
    family: FONT_CORPO,
    fonts: [
      { src: path.join(dir, 'Manrope-Regular.ttf'), fontWeight: 400 },
      { src: path.join(dir, 'Manrope-Regular.ttf'), fontWeight: 500 },
      { src: path.join(dir, 'Manrope-SemiBold.ttf'), fontWeight: 600 },
      { src: path.join(dir, 'Manrope-Bold.ttf'), fontWeight: 700 },
    ],
  })

  Font.register({
    family: FONT_DISPLAY_TEXT,
    fonts: [
      { src: path.join(dir, 'BodoniModa-Text.ttf'), fontWeight: 400 },
    ],
  })

  Font.registerHyphenationCallback((word) => [word])

  registrati = true
}
