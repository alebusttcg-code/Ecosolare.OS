import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthorizationError } from '@/lib/auth/policy'
import { guard } from '@/lib/auth/session'
import { csvRegistroFatture, nomeFileRegistro } from '@/lib/fatture/export-csv'
import { getFatturePerRegistro } from '@/lib/queries/fatture'

/**
 * Export del registro fatture emesse, in CSV, per il commercialista (ambito A6).
 *
 * Contiene importi e dati fiscali dei clienti: è ristretto ad amministrazione e
 * contabilità, non basta il permesso di sola lettura del commerciale (che vede
 * gli stati, non gli importi). Il periodo arriva come `?dal=YYYY-MM-DD&al=…`;
 * senza, l'anno in corso.
 */
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const utente = await guard('read', 'invoice')
    if (utente.role !== 'amministratore' && utente.role !== 'contabilita') {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const parsed = z
      .object({ dal: dataSchema.optional(), al: dataSchema.optional() })
      .safeParse({
        dal: url.searchParams.get('dal') || undefined,
        al: url.searchParams.get('al') || undefined,
      })
    if (!parsed.success) {
      return NextResponse.json({ errore: 'Periodo non valido.' }, { status: 400 })
    }

    const anno = new Date().getUTCFullYear()
    const dal = parsed.data.dal
      ? new Date(`${parsed.data.dal}T00:00:00.000Z`)
      : new Date(Date.UTC(anno, 0, 1))
    const al = parsed.data.al
      ? new Date(`${parsed.data.al}T23:59:59.999Z`)
      : new Date(Date.UTC(anno, 11, 31, 23, 59, 59, 999))

    const righe = await getFatturePerRegistro(dal, al)
    // BOM UTF-8: senza, l'Excel italiano sbaglia gli accenti.
    const csv = `﻿${csvRegistroFatture(righe)}`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomeFileRegistro(dal, al)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (errore) {
    if (errore instanceof AuthorizationError) {
      return NextResponse.json({ errore: 'Accesso non consentito.' }, { status: 403 })
    }
    throw errore
  }
}
