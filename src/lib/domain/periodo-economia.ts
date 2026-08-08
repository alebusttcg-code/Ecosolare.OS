export interface PeriodoEconomia {
  readonly codice: string
  readonly etichetta: string
  readonly da: Date
  readonly a: Date
}

function fineGiornata(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function inizioGiornata(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function formattaIntervallo(da: Date, a: Date): string {
  const opzioni: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${da.toLocaleDateString('it-IT', opzioni)} – ${a.toLocaleDateString('it-IT', opzioni)}`
}

/** Preset del selettore sulla pagina Economia. */
export function periodiEconomiaPreset(adesso: Date): readonly PeriodoEconomia[] {
  const anno = adesso.getFullYear()
  const mese = adesso.getMonth()

  const inizioMese = inizioGiornata(new Date(anno, mese, 1))
  const inizioMesePrec = inizioGiornata(new Date(anno, mese - 1, 1))
  const fineMesePrec = fineGiornata(new Date(anno, mese, 0))
  const inizioAnno = inizioGiornata(new Date(anno, 0, 1))
  const inizioAnnoPrec = inizioGiornata(new Date(anno - 1, 0, 1))
  const fineAnnoPrec = fineGiornata(new Date(anno - 1, 11, 31))

  return [
    { codice: 'mese', etichetta: 'Mese corrente', da: inizioMese, a: adesso },
    { codice: 'mese_prec', etichetta: 'Mese precedente', da: inizioMesePrec, a: fineMesePrec },
    { codice: 'anno', etichetta: 'Da inizio anno', da: inizioAnno, a: adesso },
    { codice: 'anno_prec', etichetta: 'Anno precedente', da: inizioAnnoPrec, a: fineAnnoPrec },
  ]
}

function parseDataLocale(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [, ys, ms, ds] = match
  const data = inizioGiornata(new Date(Number(ys), Number(ms) - 1, Number(ds)))
  if (Number.isNaN(data.getTime())) return null
  return data
}

/** Converte una data locale in `YYYY-MM-DD` per input type=date e query string. */
export function dataLocaleIso(data: Date): string {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const g = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

export function risolviPeriodoEconomia(
  params: { periodo?: string; da?: string; a?: string },
  adesso: Date,
): PeriodoEconomia {
  const preset = periodiEconomiaPreset(adesso)

  if (params.periodo === 'custom' && params.da && params.a) {
    const da = parseDataLocale(params.da)
    const aGiorno = parseDataLocale(params.a)
    if (da && aGiorno) {
      const a = fineGiornata(aGiorno)
      if (da.getTime() <= a.getTime()) {
        return {
          codice: 'custom',
          etichetta: formattaIntervallo(da, a),
          da,
          a,
        }
      }
    }
  }

  return preset.find((p) => p.codice === params.periodo) ?? preset[0]!
}

export function urlPeriodoEconomia(codice: string, da?: string, a?: string): string {
  if (codice === 'custom' && da && a) {
    return `/economia?periodo=custom&da=${encodeURIComponent(da)}&a=${encodeURIComponent(a)}`
  }
  return `/economia?periodo=${encodeURIComponent(codice)}`
}
