# Verifica per apertura al pubblico — 11 ottobre 2026

Versione candidata collaudata nel browser; pronta alla pubblicazione.

## Verifiche completate

- Controllo TypeScript e build di produzione riusciti.
- 768 combinazioni del test generale, zero errori; ulteriori 34 combinazioni lampade, zero errori. Verifiche del convertitore SVG riuscite.
- Home e tutti gli otto generatori pubblicati inclusi nella build.
- Collegamenti e risorse locali, tre worker, WebAssembly e guida PDF delle lampade presenti.
- Controllo delle risorse della release aggiunto anche alla pubblicazione automatica.

## Correzioni

- Download sospesi quando scatole e clicker stanno cambiando; svuotamento dei pezzi memorizzati dopo errori di geometria.
- Lampade: campione invalidato durante modifiche/errori; risposte di calcoli precedenti ignorate; avvisi del piatto conservati.
- Convertitore SVG: annullamento della conversione differita durante il cambio immagine; errori di caricamenti precedenti ignorati; anteprima precedente rimossa durante una nuova conversione.
- Intestazioni STL Unicode limitate in byte; durata dei collegamenti di download allungata.
- Istruzioni comuni, avviso se JavaScript è disattivato, recupero dopo errori non gestiti.
- Pulsanti e avvisi possono andare a capo; anteprima mobile non copre permanentemente le impostazioni durante lo scorrimento.

## Verifiche ancora necessarie

Il browser controllato dall’app ha rifiutato l’accesso perché non poteva verificare la policy di sicurezza amministrativa. Nessun aggiramento effettuato.

Prima della pubblicazione definitiva verificare a schermo: desktop e mobile (320/390/768 px), tema chiaro/scuro, selezione e trascinamento dei pezzi, passaggio Immagine → SVG ai cinque generatori, caricamento di SVG/STL validi e non validi, download e contenuto ZIP della lampada, apertura STL/3MF nello slicer.

Le prove software non certificano la stampabilità di ogni combinazione: incastri, switch MX e kit LED richiedono campioni fisici. Non sono stati introdotti pagamenti o modifiche alle licenze.

## Collaudo visivo completato — 11 ottobre 2026

- Home e otto generatori verificati nella build di produzione a 320, 390, 768 e 1440 px; nessuno scorrimento orizzontale della pagina. Anteprime 3D e pulsanti di download attivi dopo il calcolo.
- Tema chiaro e scuro controllati su desktop e mobile; pulsanti lunghi vanno a capo e i pannelli restano accessibili.
- Immagine di prova convertita e passata a coaster, keychain, keycap, box e christmas; geometrie generate ed export disponibili.
- Trascinamento diretto di un pezzo della scatola nella vista Stampa: selezione e coordinate aggiornate.
- Rifiuto visibile di SVG e STL non validi; STL sferico valido trasformato in lampada.
- ZIP STL e 3MF della lampada verificati: PDF identico alla guida locale, STL binari completi e modello 3MF presente.
- STL e 3MF della lampada importati in Bambu Studio. Per il 3MF generico il programma avverte che manca una configurazione di stampa e carica i dati geometrici: scegliere stampante, filamenti e profilo nello slicer. Nessuna stampa fisica eseguita.
- Typecheck, build e controllo delle risorse ripetuti con successo sulla cartella candidata. I 802 casi di geometria saranno rieseguiti anche dalla pubblicazione automatica.

Copia di sicurezza della candidata conservata separatamente prima della pubblicazione. Nessun ripristino necessario durante il collaudo.
