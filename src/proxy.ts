import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Soglia veloce: senza cookie di sessione non si entra nelle rotte app.
 *
 * Il layout fa già redirect a `/accedi`, ma in App Router pagina e layout
 * partono in parallelo: la dashboard chiamava il database (via `guard`) mentre
 * il layout stava ancora reindirizzando. Su Vercel `/` restava appesa 15–20s
 * e sembrava «non aprire» il programma. Qui il redirect avviene prima di
 * qualsiasi Server Component.
 *
 * Autorizzazione e revoca restano server-side (ADR-006): il cookie dice solo
 * «c'è una sessione», non «sei autorizzato».
 */

const COOKIE = 'ecosolare.sessione'

function percorsoPubblico(pathname: string, request: NextRequest): boolean {
  /*
   * Il segreto si confronta ripulito da entrambi i lati.
   *
   * Chi lo manda lo ripulisce (un a-capo in coda a un'intestazione HTTP non è
   * nemmeno legale); se qui si confrontasse il valore grezzo della variabile
   * d'ambiente, i due non coinciderebbero più e la stampa finirebbe
   * silenziosamente su `/accedi` — cioè il PDF fallirebbe dicendo che la pagina
   * ha reindirizzato, senza mai nominare lo spazio di troppo.
   */
  const segreto = process.env.MAINTENANCE_TOKEN?.trim()
  if (
    pathname.startsWith('/pdf-render/interno/') &&
    segreto &&
    request.headers.get('x-pdf-interno')?.trim() === segreto
  ) {
    return true
  }

  return (
    pathname === '/accedi' ||
    pathname.startsWith('/accedi/') ||
    // Pagina di stato per il cliente: il collegamento è la credenziale (D-019).
    pathname.startsWith('/stato/') ||
    pathname.startsWith('/api/intake') ||
    pathname.startsWith('/api/manutenzione') ||
    pathname.startsWith('/api/telegram/') ||
    (process.env.NODE_ENV !== 'production' &&
      pathname.startsWith('/pdf-render/demo/'))
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (percorsoPubblico(pathname, request)) {
    return NextResponse.next()
  }

  if (!request.cookies.get(COOKIE)?.value) {
    const destinazione = request.nextUrl.clone()
    destinazione.pathname = '/accedi'
    destinazione.search = ''
    return NextResponse.redirect(destinazione)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2)$).*)',
  ],
}
