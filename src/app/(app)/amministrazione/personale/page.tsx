import { redirect } from 'next/navigation'

/** Percorso storico: il personale sta in Impostazioni. */
export default function PersonaleRedirect() {
  redirect('/amministrazione/impostazioni#personale')
}
