/* eslint-disable @next/next/no-img-element -- Il renderer PDF deve controllare URL, dimensioni e decode delle immagini senza l'ottimizzatore Next. */
import type { CSSProperties, ReactNode } from 'react'
import type {
  DatiPdfPreventivo,
  IndicatorePdf,
  PlanimetriaPdfDto,
} from '@/lib/pdf/dati-preventivo'
import type { DocumentoTecnicoPreventivo } from '@/lib/pdf/premium/documenti-tecnici'
import {
  CHIUSURA_GARANZIA,
  MOTIVI_GARANZIA,
  PAGINE_MARKETING,
} from '@/lib/pdf/testi-marketing'
import { TERMINI_PAGAMENTO } from '@/lib/pdf/dossier-testi'
import { BarraEnergia, GraficoCashflow, GraficoMensile } from './grafici'
import { PdfReadySignal } from './pdf-ready'

export interface PaginaTecnicaHtml {
  readonly documento: DocumentoTecnicoPreventivo
  readonly paginaDocumento: number
}

function Logo() {
  return <img className="pdf-logo" src="/brand/ecosolare-logo.png" alt="EcoSolare" />
}

function Icona({ tipo }: { readonly tipo: 'moduli' | 'produzione' | 'autonomia' | 'foglia' | 'investimento' }) {
  const comune = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (tipo === 'moduli') {
    return <svg viewBox="0 0 32 32" aria-hidden="true"><g {...comune}>{Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => <rect key={`${x}-${y}`} x={3 + x * 7} y={3 + y * 7} width="4" height="4" rx=".5" />))}</g></svg>
  }
  if (tipo === 'produzione') {
    return <svg viewBox="0 0 32 32" aria-hidden="true"><g {...comune}><path d="M7 20h18l-3-11H10zM9 15h14M15 9l-1 11M19 9l1 11M16 20v7M11 27h10" /></g></svg>
  }
  if (tipo === 'autonomia') {
    return <svg viewBox="0 0 32 32" aria-hidden="true"><g {...comune}><circle cx="16" cy="16" r="11" /><path d="M16 5a11 11 0 0 1 8 18" stroke="#f4b800" /></g></svg>
  }
  if (tipo === 'foglia') {
    return <svg viewBox="0 0 32 32" aria-hidden="true"><g {...comune}><path d="M26 6C15 6 7 10 7 19c0 5 4 7 8 6 8-2 10-11 11-19Z" /><path d="M8 27c3-6 7-10 14-14" /></g></svg>
  }
  return <svg viewBox="0 0 32 32" aria-hidden="true"><g {...comune}><path d="M5 11h20a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3V9a4 4 0 0 1 4-4h14v6" /><rect x="20" y="16" width="8" height="6" rx="2" /><circle cx="23" cy="19" r=".7" fill="currentColor" /></g></svg>
}

function PageHeader({ dati, design = false }: { readonly dati: DatiPdfPreventivo; readonly design?: boolean }) {
  return (
    <header className={design ? 'page-header page-header-design' : 'page-header'}>
      {design ? (
        <div>
          <div className="design-brand">EcoSolare Design</div>
          <div className="design-kicker">SIMULAZIONE IMPIANTO</div>
        </div>
      ) : <Logo />}
      <div className="header-meta">
        {design ? <Logo /> : null}
        <div><span>Proposta n.</span><strong>{dati.codice}</strong></div>
        <div><span>Data</span><strong>{dati.dataDocumento}</strong></div>
      </div>
    </header>
  )
}

function PageFooter({ numero }: { readonly numero: number }) {
  return (
    <footer className="page-footer">
      <div className="footer-dot-grid" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
      <div className="footer-copy">EcoSolare • Con te verso il futuro</div>
      <div className="footer-line" />
      <div className="footer-number">{String(numero).padStart(2, '0')}</div>
    </footer>
  )
}

function PageShell({
  dati,
  numero,
  id,
  children,
  design = false,
  cover = false,
  className = '',
}: {
  readonly dati: DatiPdfPreventivo
  readonly numero: number
  readonly id: string
  readonly children: ReactNode
  readonly design?: boolean
  readonly cover?: boolean
  readonly className?: string
}) {
  return (
    <section className={`pdf-page ${cover ? 'pdf-page-cover' : ''} ${design ? 'pdf-page-design' : ''} ${className}`} data-page-id={id} data-page-number={numero}>
      <PageHeader dati={dati} design={design} />
      <div className="page-content">{children}</div>
      <PageFooter numero={numero} />
      <div className="bottom-band" aria-hidden="true"><i /><i /><i /></div>
    </section>
  )
}

function PageTitle({ eyebrow, children }: { readonly eyebrow?: string; readonly children: ReactNode }) {
  return (
    <div className="page-title">
      {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
      <h1>{children}</h1>
      <i />
    </div>
  )
}

function RoofView({
  planimetria,
  className = '',
  variante = 'progetto',
}: {
  readonly planimetria: PlanimetriaPdfDto | null
  readonly className?: string
  readonly variante?: 'esistente' | 'progetto'
}) {
  if (!planimetria) return <div className={`roof-placeholder ${className}`}>Layout tetto disponibile dopo il completamento dello studio.</div>
  const foto = variante === 'esistente'
    ? planimetria.fotoSenzaModuliDataUri
    : planimetria.fotoDataUri
  if (foto) {
    const stile = {
      '--focus-x': `${planimetria.focusXPct ?? 50}%`,
      '--focus-y': `${planimetria.focusYPct ?? 50}%`,
    } as CSSProperties
    const deveSovrapporreModuli =
      variante === 'progetto' &&
      !planimetria.fotoConModuliIntegrati &&
      planimetria.moduliPaths.length > 0
    if (deveSovrapporreModuli) {
      return <div className={`roof-photo-overlay ${className}`} style={stile}><img src={foto} alt="Vista del tetto" /><svg viewBox={planimetria.viewBox} preserveAspectRatio="xMidYMid slice" aria-label={planimetria.legenda}>{planimetria.poligoniPaths.map((path, i) => <path key={`p-${i}`} d={path} className="roof-polygon" />)}{planimetria.moduliPaths.map((path, i) => <path key={`m-${i}`} d={path} className="roof-module" />)}</svg></div>
    }
    return <img className={`roof-image ${className}`} src={foto} style={stile} alt={variante === 'esistente' ? 'Vista del tetto prima del progetto' : 'Vista del tetto con layout fotovoltaico'} />
  }
  if (variante === 'esistente') return <div className={`roof-placeholder ${className}`}>Ortofoto originale non disponibile.</div>
  return (
    <div className={`roof-svg-wrap ${className}`}>
      <svg viewBox={planimetria.viewBox} role="img" aria-label={planimetria.legenda}>
        {planimetria.poligoniPaths.map((path, i) => <path key={`p-${i}`} d={path} className="roof-polygon" />)}
        {planimetria.moduliPaths.map((path, i) => <path key={`m-${i}`} d={path} className="roof-module" />)}
      </svg>
    </div>
  )
}

/**
 * Il confronto prima/dopo si mostra solo se le due viste sono davvero diverse.
 *
 * Quando lo studio non ha catturato l'ortofoto senza moduli, il ripiego più
 * ovvio è riusare la stessa immagine — e il risultato è la stessa fotografia
 * stampata due volte sotto le didascalie «Tetto esistente» e «Progetto
 * fotovoltaico». È peggio di non avere il confronto: al cliente sembra che il
 * progetto non cambi nulla, oppure che ci siamo distratti.
 */
function confrontoTettoDisponibile(planimetria: PlanimetriaPdfDto | null): boolean {
  if (!planimetria) return false
  const senza = planimetria.fotoSenzaModuliDataUri
  if (!senza) return false
  return senza !== planimetria.fotoDataUri
}

function KpiCard({ icona, label, value, unit }: { readonly icona: Parameters<typeof Icona>[0]['tipo']; readonly label: string; readonly value: string; readonly unit: string }) {
  return <div className="cover-kpi"><div className="cover-kpi-icon"><Icona tipo={icona} /></div><div className="cover-kpi-label">{label}</div><div className="cover-kpi-rule" /><div className="cover-kpi-value">{value}<small>{unit}</small></div></div>
}

function Copertina({ dati }: { readonly dati: DatiPdfPreventivo }) {
  const kpi = dati.copertinaKpi
  const sim = dati.simulazione
  const autonomia = sim && sim.flussiNum.consumo > 0
    ? Math.min(100, Math.round((sim.flussiNum.autoconsumo / sim.flussiNum.consumo) * 100))
    : null
  const co2 = sim?.indicatori.find((i) => i.icona === 'co2')
  return (
    <PageShell dati={dati} numero={1} id="sintesi" cover>
      <div className="cover-grid" aria-hidden="true" />
      <div className="cover-letterhead">
        <div>
          <span>Da</span>
          <strong>EcoSolare</strong>
          <em>
            {dati.mittente.nome}
            {dati.mittente.ruolo ? <><br />{dati.mittente.ruolo}</> : null}
            {dati.mittente.telefono ? <><br />{dati.mittente.telefono}</> : null}
            {dati.mittente.email ? <><br />{dati.mittente.email}</> : null}
          </em>
        </div>
        <div>
          <span>Alla cortese attenzione</span>
          <strong>{dati.aziendaCliente ?? dati.clienteNome}</strong>
          <em>
            {dati.aziendaCliente ? <>{dati.clienteNome}<br /></> : null}
            {dati.immobileIndirizzo ?? dati.immobileEtichetta ?? ''}
          </em>
        </div>
      </div>
      <div className="cover-kicker">PROPOSTA ENERGETICA SU MISURA</div>
      <h1 className="cover-title">Il progetto in sintesi</h1>
      {confrontoTettoDisponibile(dati.planimetria) ? (
        <div className="roof-comparison">
          <figure><RoofView planimetria={dati.planimetria} className="cover-roof" variante="esistente" /><figcaption>Tetto esistente</figcaption></figure>
          <figure><RoofView planimetria={dati.planimetria} className="cover-roof" /><figcaption>Progetto fotovoltaico</figcaption></figure>
        </div>
      ) : (
        <RoofView planimetria={dati.planimetria} className="cover-roof cover-roof-singola" />
      )}
      {/*
        * I riquadri escono solo se i numeri ci sono. Un cartiglio che dice
        * «Potenza impianto —» non informa di niente: dichiara al cliente, in
        * prima pagina e in caratteri grandi, che i conti non li abbiamo
        * ancora fatti.
        */}
      {sim ? (
        <div className="cover-kpis">
          <KpiCard icona="moduli" label="Potenza impianto" value={kpi?.kWp ?? '—'} unit="kWp" />
          <KpiCard icona="produzione" label="Produzione annua stimata" value={dati.dettagliImpianto?.produzioneKwhNumero.toLocaleString('it-IT') ?? '—'} unit="kWh" />
          <KpiCard icona="autonomia" label="Autonomia energetica" value={autonomia != null ? String(autonomia) : '—'} unit="%" />
        </div>
      ) : null}
      <div className={sim ? 'cover-summary' : 'cover-summary cover-summary-sola'}>
        {co2 ? (
          <>
            <div className="summary-icon green"><Icona tipo="foglia" /></div>
            <div><span>Riduzione CO₂</span><strong>{co2.valore} <small>{co2.unita}</small></strong></div>
            <i />
          </>
        ) : null}
        <div className="summary-icon blue"><Icona tipo="investimento" /></div>
        <div><span>Investimento</span><strong>{dati.totaleLordo}</strong></div>
      </div>
      <div className="trust-strip"><span><b>+2.000</b> impianti realizzati</span><span><b>+500</b> monitorati ogni giorno</span><span><b>+2.000</b> clienti soddisfatti</span><span><b>€ 200.000</b> capitale versato</span></div>
    </PageShell>
  )
}

function BoxCliente({ dati }: { readonly dati: DatiPdfPreventivo }) {
  return <div className="client-box"><div><strong>{dati.clienteNome}</strong><span>{dati.immobileIndirizzo ?? dati.immobileEtichetta ?? ''}</span></div><div><strong>{dati.dataDocumento}</strong><span>{dati.titolo}</span></div></div>
}

function Elenco({ voci }: { readonly voci: readonly string[] }) {
  return <ul className="clean-list">{voci.map((voce) => <li key={voce}>{voce}</li>)}</ul>
}

function PaginaDettagli({ dati }: { readonly dati: DatiPdfPreventivo }) {
  const det = dati.dettagliImpianto
  return <PageShell dati={dati} numero={2} id="dettagli"><PageTitle eyebrow="PROGETTO PERSONALIZZATO">Dettagli impianto</PageTitle><div className="two-columns intro-columns"><div><h2>Componenti essenziali dell’offerta</h2><p>{det ? <>L’impianto proposto avrà una potenza complessiva di <b>{det.potenzaKwp}</b> e sarà composto da <b>{det.moduli} pannelli{det.wattPicco ? ` da ${det.wattPicco} Wp` : ''}</b>. La produzione annua stimata è <b>{det.produzioneKwh}</b>{det.consumoKwh ? <> a fronte di un consumo di <b>{det.consumoKwh}</b></> : null}.</> : 'I dati tecnici saranno completati dallo studio tetto associato.'}</p><h2>Regime e agevolazioni</h2><p>{det?.regimeRid ?? 'Da definire'}</p><p>L’energia non autoconsumata e immessa in rete viene valorizzata dal GSE secondo le condizioni del Ritiro Dedicato e accreditata al cliente. {det?.detrazioneSintesi ?? ''}</p></div><div className="detail-numbers"><div><span>Potenza</span><strong>{det?.potenzaKwp ?? '—'}</strong></div><div><span>Produzione annua</span><strong>{det?.produzioneKwh ?? '—'}</strong></div><div><span>Resa specifica</span><strong>{det?.resaSpecifica ?? '—'}</strong></div></div></div><h2>Dati rilevati sulle falde di progetto</h2><div className="roof-data-grid">{det?.falde.length ? det.falde.map((falda) => <div key={falda.etichetta}><strong>{falda.etichetta}</strong><dl><div><dt>Esposizione</dt><dd>{falda.esposizione}</dd></div><div><dt>Inclinazione</dt><dd>{falda.inclinazione}</dd></div>{falda.area ? <div><dt>Superficie</dt><dd>{falda.area}</dd></div> : null}</dl></div>) : <div className="empty-box">Dati delle falde disponibili dopo il completamento dello studio.</div>}</div><div className="roof-study-note"><strong>Producibilità attesa</strong><span>{dati.planimetria?.legenda ?? 'Calcolata sullo studio tetto EcoSolare e sui dati energetici inseriti nel CRM.'}</span></div></PageShell>
}

function PaginaCaratteristiche({ dati }: { readonly dati: DatiPdfPreventivo }) {
  return <PageShell dati={dati} numero={3} id="caratteristiche"><PageTitle eyebrow="FORNITURA E POSA">Caratteristiche</PageTitle><div className="feature-layout"><div>{dati.configurazioneTecnica.map((sezione) => <section className="feature-section" key={sezione.titolo}><h2>{sezione.titolo}</h2><Elenco voci={sezione.voci} /></section>)}</div><aside className="included-box"><div className="included-number">03</div><h2>Attività incluse nell’offerta</h2><Elenco voci={dati.dossierTestuale.incluso} /></aside></div></PageShell>
}

function PaginaEsclusioni({ dati }: { readonly dati: DatiPdfPreventivo }) {
  return <PageShell dati={dati} numero={4} id="garanzie"><PageTitle eyebrow="CONDIZIONI CHIARE">Esclusioni e garanzie</PageTitle><div className="two-columns legal-columns"><section><h2>Esclusioni</h2><Elenco voci={dati.dossierTestuale.escluso} /></section><section><h2>Garanzie incluse</h2>{dati.dossierTestuale.garanzie.map((garanzia) => <div className="warranty-group" key={garanzia.titolo}><h3>{garanzia.titolo}</h3><Elenco voci={garanzia.punti} /></div>)}</section></div><div className="legal-note">{dati.dossierTestuale.notaGaranzia}</div></PageShell>
}

function MarketingPage({ dati, indice }: { readonly dati: DatiPdfPreventivo; readonly indice: number }) {
  const pagina = PAGINE_MARKETING[indice]!
  const numero = 5 + indice
  return <PageShell dati={dati} numero={numero} id={['esperienza', 'qualita', 'recensioni', 'garanzia-unica'][indice] ?? `marketing-${indice}`} className={`marketing-page marketing-${pagina.disposizione}`}><PageTitle eyebrow={`${pagina.numero}. PERCHÉ ECOSOLARE`}>{pagina.sottotitolo}</PageTitle>{pagina.apertura.map((p) => <p className="marketing-copy" key={p}>{p}</p>)}{pagina.disposizione === 'loghi' ? <div className="partner-grid">{pagina.immagini.map((src) => <img key={src} src={`/${src}`} alt="Partner EcoSolare" />)}</div> : null}{pagina.disposizione === 'foto' ? <div className="certification-media">{pagina.immagini.map((src) => <img key={src} className="cert-photo" src={`/${src}`} alt="Certificazione Altroconsumo" />)}</div> : null}{pagina.disposizione === 'recensioni' ? <div className="reviews-grid">{pagina.immagini.map((src) => <img key={src} src={`/${src}`} alt="Recensione cliente EcoSolare" />)}</div> : null}{pagina.disposizione === 'certificato' ? <div className="warranty-hero"><div><span>{CHIUSURA_GARANZIA.apertura}</span><Elenco voci={MOTIVI_GARANZIA} /><p>{CHIUSURA_GARANZIA.premessa}</p><strong>{CHIUSURA_GARANZIA.claim}</strong></div><img src={`/${pagina.immagini[0]}`} alt="Certificato di garanzia EcoSolare" /></div> : null}{pagina.chiusura.map((p) => <p className="marketing-copy marketing-bottom" key={p}>{p}</p>)}</PageShell>
}

function PaginaPrezzo({ dati }: { readonly dati: DatiPdfPreventivo }) {
  const eco = dati.condizioniEconomiche
  return <PageShell dati={dati} numero={9} id="spesa"><PageTitle eyebrow="OFFERTA ECONOMICA">Preventivo di spesa</PageTitle><h2>Dettaglio economico della fornitura</h2><table className="pricing-table"><thead><tr><th>Descrizione</th><th>Q.tà</th><th>Prezzo</th><th>Sc.</th><th>IVA</th><th>Importo</th></tr></thead><tbody>{dati.righe.map((riga, i) => <tr key={`${riga.descrizione}-${i}`}><td>{riga.descrizione}</td><td>{riga.quantita} {riga.unita}</td><td>{riga.prezzoUnitario}</td><td>{riga.scontoPct ?? '—'}</td><td>{riga.ivaPct}</td><td>{riga.importo}</td></tr>)}</tbody></table><div className="pricing-sums"><div><span>Imponibile</span><strong>{dati.imponibile}</strong></div>{dati.ripartizioneIva.map((v) => <div key={v.etichetta}><span>{v.etichetta}</span><strong>{v.imposta}</strong></div>)}</div><div className="pricing-total"><span>Totale IVA inclusa</span><strong>{dati.totaleLordo}</strong></div><div className="pricing-info">{dati.bloccoTermico ? <section className="pricing-thermal"><h2>{dati.bloccoTermico.tipoEtichetta}</h2><dl><div><dt>Prezzo IVA inclusa</dt><dd>{dati.bloccoTermico.prezzoLordo}</dd></div>{dati.bloccoTermico.incentivoImporto ? <div><dt>{dati.bloccoTermico.incentivoEtichetta}</dt><dd>{dati.bloccoTermico.incentivoImporto}</dd></div> : null}<div className="net-row"><dt>Costo effettivo stimato</dt><dd>{dati.bloccoTermico.nettoIndicativo}</dd></div></dl><p>{dati.bloccoTermico.notaIncentivo}</p></section> : null}<section><h2>Investimento e agevolazioni</h2><dl><div><dt>Investimento complessivo</dt><dd>{eco?.totaleLordo ?? dati.totaleLordo}</dd></div>{eco?.detrazioneImporto ? <div><dt>{eco.detrazioneEtichetta}</dt><dd>{eco.detrazioneImporto}</dd></div> : null}{eco?.contoTermicoImporto ? <div><dt>Conto Termico 3.0</dt><dd>{eco.contoTermicoImporto}</dd></div> : null}<div className="net-row"><dt>Costo effettivo stimato</dt><dd>{eco?.nettoIndicativo ?? dati.totaleLordo}</dd></div></dl></section><section><h2>Termini di pagamento</h2><p><b>Acconto</b><br />{TERMINI_PAGAMENTO.acconto}</p><p><b>Saldo</b><br />{TERMINI_PAGAMENTO.saldo}</p><p>Offerta valida <b>{TERMINI_PAGAMENTO.validitaGiorniLavorativi} giorni lavorativi</b>.</p></section></div><p className="commercial-closing">Nella speranza di aver interpretato al meglio le vostre esigenze, EcoSolare rimane a vostra disposizione per approfondire gli aspetti finanziari ed economici di quanto esposto. Nell’attesa di un vostro gradito riscontro, porgiamo distinti saluti.</p><div className="signature-row"><div>EcoSolare</div><div>Per accettazione preventivo</div></div></PageShell>
}

function Indicatori({ indicatori }: { readonly indicatori: readonly IndicatorePdf[] }) {
  return <div className="indicator-grid">{indicatori.map((i) => <div key={i.etichetta}><span>{i.etichetta}</span><strong>{i.valore}<small>{i.unita}</small></strong></div>)}</div>
}

function PaginaPanoramica({ dati, numero }: { readonly dati: DatiPdfPreventivo; readonly numero: number }) {
  const sim = dati.simulazione
  return <PageShell dati={dati} numero={numero} id="report-panoramica" design><BoxCliente dati={dati} /><h2 className="design-section-title">Vista impianto - studio tetto</h2><RoofView planimetria={dati.planimetria} className="design-roof" /><h2 className="design-section-title">Risultati della simulazione</h2>{sim ? <><div className="finance-kpis">{sim.kpiFinanziari.map((kpi) => <div className={`tone-${kpi.tono}`} key={kpi.etichetta}><span>{kpi.etichetta}</span><strong>{kpi.valore}</strong></div>)}</div><Indicatori indicatori={sim.indicatori} /></> : <div className="empty-box">Simulazione non disponibile.</div>}</PageShell>
}

function LegendaEnergia({ colore, children }: { readonly colore: string; readonly children: ReactNode }) {
  return <div className="energy-legend"><i style={{ background: colore }} />{children}</div>
}

function PaginaEnergia({ dati, numero }: { readonly dati: DatiPdfPreventivo; readonly numero: number }) {
  const sim = dati.simulazione
  const det = dati.dettagliImpianto
  const eco = dati.condizioniEconomiche
  return <PageShell dati={dati} numero={numero} id="report-energia" design><BoxCliente dati={dati} /><h2 className="design-section-title">Consumo annuale e produzione</h2>{sim ? <><div className="energy-card"><span>Produzione {sim.flussi.produzione}</span><BarraEnergia valoreA={sim.flussiNum.autoconsumo} valoreB={sim.flussiNum.exportRete} coloreA="#2f9f70" coloreB="#2c9e9a" /><LegendaEnergia colore="#2f9f70">Verso la casa {sim.flussi.autoconsumo}</LegendaEnergia><LegendaEnergia colore="#2c9e9a">Alla rete {sim.flussi.exportRete}</LegendaEnergia></div><div className="energy-card"><span>Consumo {sim.flussiNum.consumo.toLocaleString('it-IT')} kWh</span><BarraEnergia valoreA={sim.flussiNum.autoconsumo} valoreB={sim.flussiNum.daRete} coloreA="#347fca" coloreB="#e47834" /><LegendaEnergia colore="#347fca">Dal solare {sim.flussi.autoconsumo}</LegendaEnergia><LegendaEnergia colore="#e47834">Dalla rete {sim.flussi.daRete}</LegendaEnergia></div></> : null}<h2 className="design-section-title compact">Configurazione moduli</h2><div className="module-row"><div><span>Campo fotovoltaico</span><strong>Layout da studio tetto</strong></div><div><span>Moduli</span><strong>{det?.moduli ?? '—'}</strong></div><div><span>Wp</span><strong>{det?.wattPicco ?? '—'}</strong></div><div><span>Potenza</span><strong>{det?.potenzaKwp ?? '—'}</strong></div></div><h2 className="design-section-title compact">Risparmi in bolletta - anno 1</h2><div className="bill-kpis"><div><span>Bolletta mensile attuale</span><strong>{eco?.bollettaAttualeMensile ?? '—'}</strong></div><div><span>Con impianto FV</span><strong>{eco?.bollettaConFvMensile ?? '—'}</strong></div><div><span>Risparmio mensile</span><strong>{eco?.risparmioMensile ?? '—'}</strong></div></div></PageShell>
}

function PaginaFinanza({ dati, numero }: { readonly dati: DatiPdfPreventivo; readonly numero: number }) {
  const sim = dati.simulazione
  const eco = dati.condizioniEconomiche
  return <PageShell dati={dati} numero={numero} id="report-finanza" design><BoxCliente dati={dati} /><h2 className="design-section-title">Analisi finanziaria dettagliata</h2><div className="finance-kpis large">{sim?.kpiFinanziari.map((kpi) => <div className={`tone-${kpi.tono}`} key={kpi.etichetta}><span>{kpi.etichetta}</span><strong>{kpi.valore}</strong></div>)}</div><div className="finance-split compact"><div><span>Investimento complessivo</span><strong>{eco?.totaleLordo ?? dati.totaleLordo}</strong><p>IVA inclusa, prima delle agevolazioni selezionate.</p></div><div><span>Beneficio stimato anno 1</span><strong>{eco?.risparmioAnnuo ?? '—'}</strong><p>Risparmio e valorizzazione dell’energia ceduta.</p></div></div><div className="chart-card finance-chart"><span>Flusso di cassa cumulativo</span><GraficoCashflow punti={sim?.cumulato ?? []} /></div>{sim?.termico ? <p className="fine-print">Sistema termico: gas evitato {sim.termico.gasEvitatoSmc}; risparmio annuo {sim.termico.risparmioAnnuo}; {sim.termico.incentivoEtichetta} {sim.termico.incentivoImporto ?? ''}.</p> : null}<p className="fine-print">{sim?.tariffe}</p></PageShell>
}

function PaginaCashflow({ dati, numero }: { readonly dati: DatiPdfPreventivo; readonly numero: number }) {
  const sim = dati.simulazione
  const cumulatoPerAnno = new Map(sim?.cumulato.map((p) => [String(p.anno), p.cumulatoEur.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })]) ?? [])
  return <PageShell dati={dati} numero={numero} id="report-cashflow" design><BoxCliente dati={dati} /><h2 className="design-section-title">Flusso di cassa annuale</h2><table className="cashflow-table cashflow-full"><thead><tr><th>Anno</th><th>Risparmio energetico</th><th>Agevolazioni</th><th>Flusso annuo</th><th>Cumulato</th></tr></thead><tbody>{sim?.cashflow.map((riga) => <tr key={riga.anno}><td>{riga.anno}</td><td>{riga.risparmio}{riga.risparmioTermico ? ` + ${riga.risparmioTermico}` : ''}</td><td>{riga.contoTermico ?? riga.detrazione}</td><td>{riga.flusso}</td><td>{cumulatoPerAnno.get(riga.anno) ?? '—'}</td></tr>)}</tbody></table><p className="fine-print">Simulazione EcoSolare Design calcolata sullo studio tetto del cliente. Orizzonte modello: {sim?.orizzonteAnni ?? '—'} anni.</p></PageShell>
}

function PaginaMensile({ dati, numero }: { readonly dati: DatiPdfPreventivo; readonly numero: number }) {
  const sim = dati.simulazione
  const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  return <PageShell dati={dati} numero={numero} id="report-mensile" design><BoxCliente dati={dati} /><h2 className="design-section-title">Energia mensile stimata</h2><div className="chart-card monthly"><span>Produzione mensile (kWh) - profilo annuale</span><GraficoMensile valori={sim?.produzioneMensileKwh ?? []} /><p>Produzione annua complessiva stimata: <b>{dati.dettagliImpianto?.produzioneKwh ?? '—'}</b></p></div><h2 className="design-section-title compact">Dettaglio mensile della produzione</h2><div className="monthly-data-grid">{mesi.map((mese, i) => <div key={mese}><span>{mese}</span><strong>{sim?.produzioneMensileKwh[i]?.toLocaleString('it-IT') ?? '—'} <small>kWh</small></strong></div>)}</div><p className="fine-print">Valori stimati dal profilo di producibilità dello studio associato; possono variare in funzione delle condizioni meteo e operative reali.</p></PageShell>
}

function PaginaTecnica({ dati, pagina, numero }: { readonly dati: DatiPdfPreventivo; readonly pagina: PaginaTecnicaHtml; readonly numero: number }) {
  return <PageShell dati={dati} numero={numero} id={`tecnica-${pagina.documento.id}-${pagina.paginaDocumento}`} className="technical-page"><div className="technical-kicker">DOCUMENTAZIONE TECNICA</div><h1>{pagina.documento.title}</h1><div className="technical-version">Versione {pagina.documento.versionLabel} • pagina originale {pagina.paginaDocumento}</div><div className="technical-slot" data-technical-document-id={pagina.documento.id} data-technical-source-page={pagina.paginaDocumento} /></PageShell>
}

/** Le pagine commerciali: ci sono sempre, qualunque cosa si venda. */
const PAGINE_COMMERCIALI = 9

/**
 * Le cinque pagine «EcoSolare Design» vivono di simulazione.
 *
 * Senza studio tetto uscivano lo stesso, con i titoli stampati e le tabelle
 * vuote: cinque pagine che dicono al cliente che i conti non li abbiamo
 * ancora fatti. Un documento di nove pagine dice meno, ma dice tutto quello
 * che stampa — ed è il solo modo per non spedire un preventivo che sembra
 * incompiuto.
 */
const PAGINE_SIMULAZIONE = [
  PaginaPanoramica,
  PaginaEnergia,
  PaginaFinanza,
  PaginaCashflow,
  PaginaMensile,
] as const

export function QuoteDocument({ dati, pagineTecniche = [] }: { readonly dati: DatiPdfPreventivo; readonly pagineTecniche?: readonly PaginaTecnicaHtml[] }) {
  const simulazione = dati.simulazione ? PAGINE_SIMULAZIONE : []
  const primaPaginaTecnica = PAGINE_COMMERCIALI + simulazione.length
  const totale = primaPaginaTecnica + pagineTecniche.length

  return <><PdfReadySignal /><main className="pdf-document" data-template-version="html-v1" data-total-pages={totale}><Copertina dati={dati} /><PaginaDettagli dati={dati} /><PaginaCaratteristiche dati={dati} /><PaginaEsclusioni dati={dati} />{Array.from({ length: 4 }, (_, indice) => <MarketingPage key={indice} dati={dati} indice={indice} />)}<PaginaPrezzo dati={dati} />{simulazione.map((Pagina, indice) => <Pagina key={indice} dati={dati} numero={PAGINE_COMMERCIALI + indice + 1} />)}{pagineTecniche.map((pagina, indice) => <PaginaTecnica key={`${pagina.documento.id}-${pagina.paginaDocumento}`} dati={dati} pagina={pagina} numero={primaPaginaTecnica + indice + 1} />)}</main></>
}
