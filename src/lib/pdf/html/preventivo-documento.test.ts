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
    expect(html).toContain('Dati rilevati sulle falde di progetto')
    expect(html).toContain('Dettaglio mensile della produzione')
    expect(html).not.toContain('Layout moduli sul tetto')
    expect(html).toContain('Nella speranza di aver interpretato al meglio')
    expect(html).toContain('>25</td>')
    expect(html).not.toContain('<canvas')
  })

  /*
   * Il confronto prima/dopo vale solo se le due viste sono diverse. Quando lo
   * studio non ha la cattura del tetto senza moduli, il ripiego naturale è
   * riusare la stessa foto — e il cliente si trova la stessa immagine due
   * volte sotto due didascalie che dicono il contrario.
   */
  it('mostra una vista sola quando manca l’ortofoto senza moduli', () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDocument, { dati: WALTER_RICCI_HTML_FIXTURE }),
    )
    expect(html).not.toContain('Tetto esistente')
    expect(html).toContain('cover-roof-singola')
  })

  it('mostra una vista sola anche se le due ortofoto coincidono', () => {
    const conDoppione = {
      ...WALTER_RICCI_HTML_FIXTURE,
      planimetria: WALTER_RICCI_HTML_FIXTURE.planimetria
        ? {
            ...WALTER_RICCI_HTML_FIXTURE.planimetria,
            fotoSenzaModuliDataUri: WALTER_RICCI_HTML_FIXTURE.planimetria.fotoDataUri,
          }
        : null,
    }
    const html = renderToStaticMarkup(createElement(QuoteDocument, { dati: conDoppione }))
    expect(html).not.toContain('Tetto esistente')
  })

  it('mostra il confronto quando le due viste sono davvero diverse', () => {
    const conConfronto = {
      ...WALTER_RICCI_HTML_FIXTURE,
      planimetria: WALTER_RICCI_HTML_FIXTURE.planimetria
        ? {
            ...WALTER_RICCI_HTML_FIXTURE.planimetria,
            fotoSenzaModuliDataUri: '/preventivo/reference/walter-tetto-nudo.jpg',
          }
        : null,
    }
    const html = renderToStaticMarkup(createElement(QuoteDocument, { dati: conConfronto }))
    expect(html).toContain('Tetto esistente')
    expect(html).toContain('Progetto fotovoltaico')
    expect(html).toContain('walter-tetto-nudo.jpg')
  })

  /*
   * Pagina 3 e pagina 9 devono adattarsi a cosa il cliente compra davvero:
   * le voci del termico parlano di caldaia da smontare e iscrizione FGAS, e su
   * un preventivo di solo fotovoltaico descriverebbero un lavoro che nessuno
   * farà.
   */
  it('senza impianto termico non nomina FGAS né il suo blocco economico', () => {
    const soloFv = {
      ...WALTER_RICCI_HTML_FIXTURE,
      bloccoTermico: null,
      titolo: 'Impianto fotovoltaico',
      configurazioneTecnica: WALTER_RICCI_HTML_FIXTURE.configurazioneTecnica.filter(
        (sezione) => !/termic|calda|pompa di calore/i.test(sezione.titolo),
      ),
    }
    const html = renderToStaticMarkup(createElement(QuoteDocument, { dati: soloFv }))
    // Le voci che tradiscono un lavoro idraulico mai preventivato.
    expect(html).not.toMatch(/FGAS/i)
    expect(html).not.toMatch(/smontaggio e smaltimento/i)
    expect(html).not.toMatch(/lavaggio impianto/i)
    expect(html).not.toContain('pricing-thermal')
  })

  it('con impianto termico mostra il suo blocco economico separato', () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDocument, { dati: WALTER_RICCI_HTML_FIXTURE }),
    )
    const termico = WALTER_RICCI_HTML_FIXTURE.bloccoTermico
    if (!termico) throw new Error('la fixture deve avere un blocco termico')
    expect(html).toContain('pricing-thermal')
    expect(html).toContain(termico.tipoEtichetta)
    expect(html).toContain(termico.prezzoLordo)
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
