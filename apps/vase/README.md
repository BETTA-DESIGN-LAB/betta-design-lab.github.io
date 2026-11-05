# Vasi d’arredo

Generatore originale con dieci silhouette, sei sezioni, dieci finiture e sei preset. Forma del corpo, sezione, torsione e finitura sono indipendenti.

## Finiture a zone

Canneté, lame, spirali, reticolo in rilievo, anelli, onde, diamanti, nido d’ape e pois. Inizio/fine in percentuale dell’altezza e raccordo morbido regolabile. Scelte rapide per metà alta, metà bassa, tutta altezza e piede/collo lisci. La finitura non è una sovrapposizione grafica: è nella geometria STL/3MF.

Il reticolo resta su una parete continua; non genera una rete aperta. I rilievi sono verso l’esterno e la cavità rimane liscia. L’offset della sezione più stretta mantiene uno spessore trasversale minimo, che aumenta nelle sezioni più larghe. Gli sbalzi e la tenuta reale dipendono dalla stampa.

La silhouette Su misura permette di regolare corpo e collo, oltre a piede e bocca. Non è un editor SVG o un editor di punti liberi.

## Interazione e prestazioni

Calcolo in un worker, richieste accorpate durante gli spostamenti. L’anteprima precedente rimane visibile finché la nuova geometria è pronta; l’export viene temporaneamente disattivato. Campi numerici digitabili opzionali nel componente slider condiviso, attivi solo nel generatore vasi. Controlli non applicabili nascosti, senza cancellarne i valori.

Preset iniziale Mezza lama; i link precedenti privi delle nuove opzioni mantengono il precedente modello. La geometria storica è conservata per le combinazioni originali senza finiture o silhouette aggiuntive.

## Export e verifiche

STL del vaso completo e 3MF con profilo oggetto standard, senza imporre macchina o filamenti. Controllo del volume della stampante selezionata, compresa l’altezza. Link condivisibile con la configurazione.

scripts/test-vase-design.ts: cento combinazioni silhouette/finitura, sei sezioni con torsione e drenaggio, sei preset, esportazioni e verifica geometrica che le zone lisce non contengano rilievi. Le regressioni originali dei tre profili restano nella suite.

Backup locale in backups/vase-before-design-upgrade e cronologia GitHub. Implementazione originale, senza copiare codice del riferimento PrintPal.
