import { redirect } from 'next/navigation'

export const metadata = { title: 'Dashboard — EcoSolare OS' }

/** Metriche commerciali sono confluite nella sezione Performance della Dashboard. */
export default async function MetrichePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const { periodo } = await searchParams
  // Il vecchio `periodo` delle metriche è la coorte lead sulla Dashboard.
  if (periodo) redirect(`/?coorte=${encodeURIComponent(periodo)}`)
  redirect('/')
}
