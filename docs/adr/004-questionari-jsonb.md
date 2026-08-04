# ADR-004 — Risposte dei questionari in JSONB versionato

**Stato:** accettata · **Data:** 4 agosto 2026

## Contesto

Prequalifica e sopralluoghi hanno decine di campi, condizionali, che cambieranno spesso — soprattutto nei primi mesi, quando l'ufficio tecnico affinerà la checklist.

## Decisione

- `survey_templates`: definizione **versionata** dei campi, condizioni e obbligatorietà.
- `surveys.answers`: JSONB, validato a runtime contro lo schema del template.
- **Colonne promosse**: i pochi campi usati in filtri, liste e KPI (potenza stimata, tipo tetto, comune, esito) sono anche colonne vere, popolate alla scrittura.

## Motivazione

L'alternativa EAV (una riga per risposta) rende ogni lettura una query con N join o un pivot. Per un questionario da 40 campi, mostrare un sopralluogo diventa costoso e il codice illeggibile.

Il JSONB puro, però, rende impossibile filtrare e aggregare in modo efficiente. Da qui le colonne promosse: si paga una piccola ridondanza controllata dove serve prestazione, si tiene la flessibilità dove serve flessibilità.

## Conseguenze

- Cambiare un template non richiede una migrazione.
- I sopralluoghi storici restano leggibili con il template della loro versione.
- **Costo:** promuovere un campo dopo che esistono dati richiede una migrazione dati. Va deciso quali campi promuovere quando il template si stabilizza, non prima.
- La validazione è responsabilità dell'applicazione (Zod), non del database.

## Alternativa considerata

EAV normalizzato (`survey_answers`). Scartata: costo di lettura permanente per un beneficio di integrità che Zod fornisce comunque.
