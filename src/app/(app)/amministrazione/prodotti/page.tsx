import { Intestazione } from '@/components/ui'
import { getDb } from '@/db'
import { guard } from '@/lib/auth/session'
import { getCatalogoConSchede } from '@/lib/queries/documenti-tecnici'
import { CatalogoSchede } from './catalogo'

export const metadata = { title: 'Schede prodotto — EcoSolare OS' }

/**
 * Le schede tecniche vivono qui, non nel preventivo.
 *
 * Chi prepara l'offerta sceglie i prodotti; gli allegati seguono da soli. È il
 * solo modo per non spedire la scheda di una batteria che il cliente non ha
 * comprato, o la revisione del 2023 di un pannello che nel frattempo è cambiato.
 */
export default async function ProdottiPage() {
  await guard('update', 'settings')

  const catalogo = await getCatalogoConSchede(getDb())
  const conSchede = catalogo.filter((prodotto) =>
    prodotto.schede.some((scheda) => scheda.isActive),
  ).length

  return (
    <div className="space-y-6">
      <Intestazione
        eyebrow="Amministrazione"
        titolo="Schede prodotto"
        sottotitolo={
          conSchede === 1
            ? `1 prodotto su ${catalogo.length} ha una scheda da allegare al preventivo.`
            : `${conSchede} prodotti su ${catalogo.length} hanno una scheda da allegare al preventivo.`
        }
      />
      <CatalogoSchede catalogo={catalogo} />
    </div>
  )
}
