import { redirect } from 'next/navigation'

export const metadata = { title: 'Cantieri — EcoSolare OS' }

/**
 * L'archivio è confluito in «Cantieri», come filtro.
 *
 * Era la stessa query con un argomento diverso — `listProjects(utente,
 * 'completate')` — presentata come una seconda voce di menu. Un cantiere
 * chiuso non è un altro oggetto: è lo stesso cantiere, dopo. La rotta resta
 * viva per i segnalibri.
 */
export default function LavoriCompletatiPage() {
  redirect('/cantieri?stato=completati')
}
