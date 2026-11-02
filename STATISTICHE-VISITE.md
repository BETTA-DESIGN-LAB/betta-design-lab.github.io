# Statistiche visite - account collegato

Integrazione GoatCounter predisposta per home e tutte le pagine generate dalla build. Nessuna modifica alle geometrie o all’interfaccia. Account collegato: https://bettadesignlab.goatcounter.com. Configurazione attiva; pubblicazione GitHub avviata il 12 ottobre 2026.

## Attivazione
1. Creare l’account su https://www.goatcounter.com/signup e indicare il sito https://betta-design-lab.github.io.
2. Comunicare l’indirizzo del pannello. Non serve password né chiave API.
3. Inserire in public/analytics-config.json l’endpoint https://NOME.goatcounter.com/count e impostare enabled a true.
4. Pubblicare soltanto i file necessari e aprire il sito pubblico. Controllare la prima visita nel pannello. Un blocco pubblicitario può impedire il conteggio.

## Dati e reversibilità
Il contatore registra la pagina aperta e la provenienza limitata al dominio. Esclude query, configurazioni nel frammento, contenuti SVG/STL e campi del preventivo. I cambi di impostazioni non generano nuove visite. L’integrazione non carica il contatore su localhost e non trasmette nulla finché disattivata.
Per spegnerlo impostare enabled a false e pubblicare analytics-config.json. Nessun cambio ai tool. I dati già raccolti si gestiscono dal pannello GoatCounter.

Verifiche: node scripts/test-analytics.mjs, pnpm typecheck, pnpm build, pnpm check:release. Le visite precedenti all’attivazione non sono recuperabili. File del contatore e vite.config.ts caricati su GitHub; test e documentazione conservati localmente. Pubblicazione automatica completata con successo: commit e94807a3beece4cdaa3fd61a9eb3437552009de1, run 38291976009. Visita reale alla home ricevuta nel pannello (1 visita di prova); script con endpoint corretto verificato sul sito pubblico.
