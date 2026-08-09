import { redirect } from 'next/navigation'

/** Percorso storico: l’anagrafica vive in Amministrazione → Personale. */
export default function OperaiRedirect() {
  redirect('/amministrazione/personale')
}
