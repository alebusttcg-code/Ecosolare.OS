import { redirect } from 'next/navigation'

export const metadata = { title: 'Dashboard — EcoSolare OS' }

/** Economia è confluita nella Dashboard unica (solo amministratore). */
export default async function EconomiaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; da?: string; a?: string }>
}) {
  const params = await searchParams
  const q = new URLSearchParams()
  if (params.periodo) q.set('periodo', params.periodo)
  if (params.da) q.set('da', params.da)
  if (params.a) q.set('a', params.a)
  const qs = q.toString()
  redirect(qs ? `/?${qs}` : '/')
}
