# ADR-003 — Il lead non è un'entità separata

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Il brief elenca `leads` e `opportunities` come tabelle distinte, seguendo la convenzione di molti CRM commerciali.

## Decisione

Il lead è **uno stadio dell'opportunità**, non un'entità. Non esiste una tabella `leads`.

Resta separata `inbound_submissions`: il payload grezzo e immutabile ricevuto dal canale (form, webhook, email), conservato per audit e deduplica.

## Motivazione

Con entità separate, ogni lead qualificato richiede una conversione che duplica contatto, note e storico. Da quel momento in poi ogni ricerca, ogni report e ogni timeline devono interrogare due tabelle e ricucire il risultato. Il costo non è la conversione: è che si paga per sempre.

Tenere l'intake grezzo separato risolve invece un problema reale: quando un lead arriva malformato o duplicato, serve poter vedere **cosa era arrivato davvero**, non cosa il sistema ne ha dedotto.

## Conseguenze

- Una sola timeline cliente, senza ricuciture.
- Gli stati iniziali della pipeline (`nuovo`, `da contattare`, `qualificato`) sono stadi come gli altri.
- **Costo:** chi arriva da altri CRM troverà l'assenza di una sezione "Lead" contro-intuitiva. Si risolve con la denominazione nell'interfaccia, non con lo schema.

## Alternativa considerata

Tabella `leads` distinta con conversione esplicita. Scartata: duplicazione permanente in cambio di familiarità.
