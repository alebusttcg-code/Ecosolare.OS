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

function percorsoPubblico(pathname: string): boolean {
  return (
    pathname === '/accedi' ||
    pathname.startsWith('/accedi/') ||
    pathname.startsWith('/api/intake') ||
    pathname.startsWith('/api/manutenzione')
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (percorsoPubblico(pathname)) {
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
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
