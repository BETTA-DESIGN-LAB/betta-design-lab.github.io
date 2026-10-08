# Portachiavi

Generatore locale nel browser, con identità Betta Design Lab condivisa.

- Nome sagomato: font corsivo, moderno o classico e bordo regolabile; i fori interni delle lettere vengono riempiti e le isole della base vengono collegate. SVG e icona aggiuntivi hanno posizione, scala, rotazione e colore indipendenti e partecipano alla stessa sagoma piena.
- Iniziale: targhetta, disco o lettera sagomata; iniziale incassata con colore indipendente e nome sovrapposto.
- SVG e icone: rilievo, intarsio o incisione; posizione, rotazione e scala. La sagoma da SVG richiede aree piene connesse.
- QR: link, testo, telefono, email o Wi-Fi codificato localmente; targhetta, disco, ovale, esagono o cuore; posizione, dimensione e rotazione indipendenti; SVG/icona fuori dal margine libero; quattro moduli di margine bianco e intarsio scuro. Nessun invio a servizi esterni. Verificare la scansione della stampa reale; dimensione, materiale e colori influenzano il risultato.
- Maglia: nome, numero e squadra con dimensioni e posizioni indipendenti; sette motivi della divisa, colletto, bordo e contorno scritte opzionali; colori indipendenti e anello rimovibile. Sagoma e geometrie originali.
- Musica: importazione di un codice Spotify già creato, SVG o immagine, e copertina facoltativa tracciata in un colore. Non genera il codice Spotify da un URL e non riproduce copertine fotografiche a colori.

STL dell’assemblato, 3MF multicolore, STL del pezzo selezionato e ZIP di 3MF per i piatti separati. I pezzi separati poggiano sul piatto, vengono disposti automaticamente e possono essere trascinati. Tre piatti disponibili: 180, 220 e 256 mm; overflow su piatti successivi. Il controllo degli ingombri blocca lo ZIP se pezzi spostati si sovrappongono o escono dai margini.

Per i rilievi stampati separatamente viene creata una sede di montaggio di 0,25 mm e il pezzo decorativo riceve il tratto corrispondente da inserire. La forma assemblata resta identica. Gli intarsi mantengono la sede esistente. Il sistema è condiviso con sottobicchieri, fidget clicker e scatole.

Foro interno alla base oppure anello esterno, disattivabile. La password Wi-Fi resta solo in memoria e non entra nei parametri dell’URL.

Per intarsi stampati separatamente è disponibile un gioco regolabile; per stampa multicolore usare 0. Le tolleranze finali richiedono una prova sulla propria stampante.

SVG e immagini caricati restano in memoria: ricaricando la pagina occorre importarli di nuovo. Le posizioni manuali sui piatti restano nella sessione corrente.

`src/vendor/qrcode.mjs`: qrcode-generator 2.0.4, MIT, copyright Kazuhiko Arase. Licenza conservata in vendor/LICENSE.txt e distribuita in public/third-party-licenses.txt.
