import { redirect } from 'next/navigation'

/** Percorso storico: la sezione si chiama Impostazioni. */
export default function ConfigurazioniRedirect() {
  redirect('/amministrazione/impostazioni')
}
