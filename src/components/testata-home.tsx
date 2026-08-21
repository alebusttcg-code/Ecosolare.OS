import { SfondoSolare } from './sfondo-solare'

/**
 * Testata delle home per ruolo: il saluto su un banner con l'accenno della scena
 * solare (un tetto di pannelli all'alba, discreto). È il momento d'ingresso dopo
 * l'accesso — può respirare — ma resta più sobrio della soglia di login: lo usa
 * solo la home, non le pagine di lavoro. Chiude con la busbar del sistema.
 */
export function TestataHome({
  eyebrow,
  titolo,
  sottotitolo,
}: {
  eyebrow?: string
  titolo: string
  sottotitolo?: string
}) {
  return (
    <div
      className="rivela relative mb-8 overflow-hidden rounded-2xl border lg:mb-10"
      style={{
        borderColor: 'var(--bordo)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 60px -40px rgba(0,0,0,0.9)',
      }}
    >
      <SfondoSolare variante="accenno" />

      <div className="relative z-10 px-6 pt-7 sm:px-8 sm:pt-9">
        {eyebrow ? <p className="mb-1.5 eyebrow">{eyebrow}</p> : null}
        <h1
          className="titolo-oro text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ textShadow: '0 1px 22px rgba(4,7,13,0.55)' }}
        >
          {titolo}
        </h1>
        {sottotitolo ? (
          <p
            className="mt-1.5 max-w-2xl text-sm"
            style={{
              color: 'var(--testo-tenue)',
              textShadow: '0 1px 12px rgba(4,7,13,0.7)',
            }}
          >
            {sottotitolo}
          </p>
        ) : null}
      </div>

      {/* Busbar di sistema in basso, come le testate di pagina e di card. */}
      <div className="relative z-10 mt-5 flex items-center px-6 pb-5 sm:px-8">
        <span
          className="h-[2px] w-10 shrink-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #f2dda0, #d9a441)',
            boxShadow: '0 0 8px rgba(217,164,65,0.4)',
          }}
        />
        <span
          className="h-px flex-1"
          style={{
            background:
              'linear-gradient(90deg, rgba(217,164,65,0.5) 0%, rgba(217,164,65,0.18) 30%, transparent 85%)',
          }}
        />
      </div>
    </div>
  )
}
