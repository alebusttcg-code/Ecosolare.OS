/* eslint-disable @next/next/no-img-element -- Il renderer PDF controlla il logo senza l'ottimizzatore Next. */
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import { PdfReadySignal } from './pdf-ready'

export interface RigaFatturaPdf {
  readonly descrizione: string
  readonly imponibile: string
  readonly aliquota: string
  readonly imposta: string
}

export interface DatiFatturaPdf {
  readonly numero: string
  readonly data: string
  readonly tipo: 'fattura' | 'acconto' | 'nota_credito'
  readonly causale: string | null
  readonly cliente: {
    readonly denominazione: string
    readonly codiceFiscale: string | null
    readonly partitaIva: string | null
    readonly indirizzo: string | null
    readonly cittaRiga: string | null
  }
  readonly righe: readonly RigaFatturaPdf[]
  readonly ripartizione: readonly {
    readonly aliquota: string
    readonly imponibile: string
    readonly imposta: string
  }[]
  readonly imponibile: string
  readonly imposta: string
  readonly totale: string
  /** Ragione sociale dell'azienda cedente; fallback al marchio se non configurata. */
  readonly aziendaRagioneSociale: string
  /** P.IVA dell'azienda cedente, se configurata. */
  readonly aziendaPartitaIva: string | null
}

const TITOLO: Record<DatiFatturaPdf['tipo'], string> = {
  fattura: 'Fattura',
  acconto: 'Fattura di acconto',
  nota_credito: 'Nota di credito',
}

const P = ECOSOLARE.pdf
const sede = ECOSOLARE.sedi[0]

export function FatturaDocument({ dati }: { readonly dati: DatiFatturaPdf }) {
  return (
    <>
      <PdfReadySignal />
      <main className="pdf-document" data-template-version="fattura-v1">
        <section
          className="pdf-page"
          style={{
            boxSizing: 'border-box',
            padding: '18mm 16mm',
            background: P.carta,
            color: P.inchiostro,
            fontFamily: 'Manrope, system-ui, sans-serif',
            fontSize: '10.5px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Intestazione: azienda cedente */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <img src="/brand/ecosolare-logo.png" alt="EcoSolare" style={{ height: '13mm', marginBottom: '3mm' }} />
              <div style={{ color: P.inchiostroMorbido, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: P.inchiostro }}>{dati.aziendaRagioneSociale}</div>
                <div>{sede.via} · {sede.capCitta}</div>
                <div>{sede.telefono} · {ECOSOLARE.email}</div>
                {dati.aziendaPartitaIva ? <div>P.IVA {dati.aziendaPartitaIva}</div> : null}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: P.bluScuro }}>
                {TITOLO[dati.tipo]}
              </div>
              <div style={{ marginTop: '2mm', fontSize: '13px', fontWeight: 600 }}>N. {dati.numero}</div>
              <div style={{ color: P.inchiostroMorbido }}>del {dati.data}</div>
            </div>
          </header>

          {/* Cliente */}
          <section
            style={{
              marginTop: '9mm',
              padding: '4mm 5mm',
              background: P.cartaSoft,
              border: `1px solid ${P.linea}`,
              borderRadius: '2mm',
              maxWidth: '95mm',
            }}
          >
            <div style={{ fontSize: '8px', letterSpacing: '.08em', textTransform: 'uppercase', color: P.inchiostroMorbido }}>
              Intestatario
            </div>
            <div style={{ fontWeight: 700, fontSize: '12px', marginTop: '1mm' }}>
              {dati.cliente.denominazione}
            </div>
            <div style={{ color: P.inchiostroMorbido, lineHeight: 1.5, marginTop: '1mm' }}>
              {dati.cliente.indirizzo ? <div>{dati.cliente.indirizzo}</div> : null}
              {dati.cliente.cittaRiga ? <div>{dati.cliente.cittaRiga}</div> : null}
              {dati.cliente.partitaIva ? <div>P.IVA {dati.cliente.partitaIva}</div> : null}
              {dati.cliente.codiceFiscale ? <div>C.F. {dati.cliente.codiceFiscale}</div> : null}
            </div>
          </section>

          {/* Righe */}
          <table style={{ marginTop: '8mm', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${P.bluScuro}`, color: P.inchiostroMorbido, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                <th style={{ textAlign: 'left', padding: '2mm 1mm' }}>Descrizione</th>
                <th style={{ textAlign: 'right', padding: '2mm 1mm', width: '28mm' }}>Imponibile</th>
                <th style={{ textAlign: 'right', padding: '2mm 1mm', width: '16mm' }}>IVA</th>
                <th style={{ textAlign: 'right', padding: '2mm 1mm', width: '26mm' }}>Imposta</th>
              </tr>
            </thead>
            <tbody>
              {dati.righe.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${P.linea}` }}>
                  <td style={{ padding: '2.5mm 1mm' }}>{r.descrizione}</td>
                  <td style={{ padding: '2.5mm 1mm', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.imponibile}</td>
                  <td style={{ padding: '2.5mm 1mm', textAlign: 'right' }}>{r.aliquota}</td>
                  <td style={{ padding: '2.5mm 1mm', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.imposta}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Riepilogo */}
          <div style={{ marginTop: '8mm', display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ width: '85mm', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <tbody>
                {dati.ripartizione.map((r, i) => (
                  <tr key={i} style={{ color: P.inchiostroMorbido }}>
                    <td style={{ padding: '1mm 1mm' }}>Imponibile IVA {r.aliquota}</td>
                    <td style={{ padding: '1mm 1mm', textAlign: 'right' }}>{r.imponibile}</td>
                    <td style={{ padding: '1mm 1mm', textAlign: 'right' }}>{r.imposta}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 600, borderTop: `1px solid ${P.linea}` }}>
                  <td style={{ padding: '2mm 1mm' }}>Totale imponibile</td>
                  <td colSpan={2} style={{ padding: '2mm 1mm', textAlign: 'right' }}>{dati.imponibile}</td>
                </tr>
                <tr style={{ fontWeight: 600 }}>
                  <td style={{ padding: '1mm 1mm' }}>Totale IVA</td>
                  <td colSpan={2} style={{ padding: '1mm 1mm', textAlign: 'right' }}>{dati.imposta}</td>
                </tr>
                <tr style={{ fontWeight: 700, fontSize: '13px', color: P.bluScuro, borderTop: `1.5px solid ${P.bluScuro}` }}>
                  <td style={{ padding: '2.5mm 1mm' }}>Totale documento</td>
                  <td colSpan={2} style={{ padding: '2.5mm 1mm', textAlign: 'right' }}>{dati.totale}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer style={{ marginTop: 'auto', paddingTop: '8mm', color: P.inchiostroMorbido, fontSize: '8.5px', lineHeight: 1.5 }}>
            {dati.causale ? <div style={{ marginBottom: '2mm' }}>{dati.causale}</div> : null}
            <div>
              Documento di cortesia. La fattura elettronica originale è trasmessa al
              Sistema di Interscambio (SdI); questo riepilogo non ha valore fiscale.
            </div>
          </footer>
        </section>
      </main>
    </>
  )
}
