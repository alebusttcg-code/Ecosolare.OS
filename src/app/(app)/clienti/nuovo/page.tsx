import { guard } from '@/lib/auth/session'
import { FormNuovoCliente } from './form'

export const metadata = { title: 'Nuovo cliente — EcoSolare OS' }

export default async function NuovoClientePage() {
  await guard('create', 'contact')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Nuovo cliente</h1>
      <FormNuovoCliente />
    </div>
  )
}
