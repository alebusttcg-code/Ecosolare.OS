import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WALTER_RICCI_HTML_FIXTURE } from './fixture-walter'
import { QuoteDocument } from './preventivo-documento'

describe('template HTML del preventivo', () => {
  it('mantiene ordine, metadati e quattordici pagine base', () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDocument, { dati: WALTER_RICCI_HTML_FIXTURE }),
    )
    const ids = [...html.matchAll(/data-page-id="([^"]+)"/g)].map(
      (match) => match[1],
    )

    expect(ids).toEqual([
      'sintesi',
      'dettagli',
      'caratteristiche',
      'garanzie',
      'esperienza',
      'qualita',
      'recensioni',
      'garanzia-unica',
      'spesa',
      'report-panoramica',
      'report-energia',
      'report-finanza',
      'report-cashflow',
      'report-mensile',
    ])
    expect(html).toContain('data-template-version="html-v1"')
    expect(html).toContain('T-2026-0167')
    expect(html).toContain('03/08/2026')
    expect(html).not.toContain('<canvas')
  })

  it('aggiunge un wrapper per ogni pagina tecnica selezionata', () => {
    const documento = {
      id: 'scheda-inverter',
      productId: 'inverter-1',
      title: 'Scheda inverter',
      versionLabel: '2026.1',
      storageKey: 'prodotti/inverter.pdf',
      mimeType: 'application/pdf',
      checksum: null,
      includedPages: [2],
      sortOrder: 0,
    } as const
    const html = renderToStaticMarkup(
      createElement(QuoteDocument, {
        dati: WALTER_RICCI_HTML_FIXTURE,
        pagineTecniche: [{ documento, paginaDocumento: 2 }],
      }),
    )

    expect(html.match(/class="pdf-page/g)).toHaveLength(15)
    expect(html).toContain('data-technical-document-id="scheda-inverter"')
    expect(html).toContain('data-technical-source-page="2"')
    expect(html).toContain('data-total-pages="15"')
  })

  it('vincola la stampa ad A4 senza margini del browser', () => {
    const css = readFileSync(
      path.join(process.cwd(), 'src/app/pdf-render/preventivo.css'),
      'utf8',
    )

    expect(css).toMatch(/@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/s)
    expect(css).toMatch(/\.pdf-page\s*{[^}]*width:\s*210mm;[^}]*height:\s*297mm;/s)
    expect(css).toContain('break-after: page')
    expect(css).not.toMatch(/\b(?:vw|vh)\b/)
  })
})
