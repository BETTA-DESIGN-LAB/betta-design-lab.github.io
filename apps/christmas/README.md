# Natale

Geometrie originali Betta Design Lab: sette sagome piatte (pallina, alberello, stella, fiocco di neve, cuore, campanella e omino) e pallina cava liscia, ondulata o a spirale in due semisfere.

Testo vuoto rimuove la scritta. “Scritta dentro la sagoma” adatta il nome intero al contorno; disattivandolo, il nome può uscire dalla sagoma. Nei fiocchi di neve il limite è l’inviluppo delle punte. Testo e un SVG o un'icona si possono combinare e trascinare nella vista di personalizzazione. Gli SVG rimangono nella sessione e non sono codificati nel link.

La vista compatta mostra l'oggetto montato. La vista sul piatto separa i pezzi e consente di spostarli; l'esportazione ZIP contiene un 3MF per piatto. Le decorazioni separate hanno una sede di 0,25 mm nella base. Le incisioni sferiche vengono limitate automaticamente per conservare il guscio e l'incastro.

Le semisfere sono orientate con il bordo di giunzione sul piatto. Verificare nello slicer supporti e orientamento dei piccoli inserti curvi. L'incastro non è stato verificato con una stampa fisica: stampare un campione e regolare il gioco in base a materiale e stampante. Non sono previsti candele o fonti di calore all'interno.

Verifica: `pnpm typecheck`, `pnpm test`, `pnpm build`. I test includono le geometrie esistenti e le combinazioni di sagome, superfici, tecniche e dimensioni del nuovo generatore.

## Interazione

Il pannello mostra soltanto i controlli applicabili: nessuna opzione tipografica senza testo, nessun colore degli inserti in incisione, nessun foro senza anello e nessuna regolazione delle coste sulla superficie liscia. Le sezioni aperte e il cursore della scritta vengono conservati quando il pannello si aggiorna.

Testo, simbolo, colori e impostazioni comuni rimangono durante i cambi di modello. Ogni modello conserva le posizioni e la disposizione sul piatto; nel passaggio alla sfera vengono adattate solo le misure/posizioni fuori dall'area decorabile. La scritta contenuta viene avvicinata automaticamente alla sagoma quando necessario.

Il calcolo delle due versioni della geometria avviene in un worker. Mentre il calcolo procede, l'interfaccia resta utilizzabile; richieste superate vengono ignorate e gli export si riattivano soltanto per la configurazione corrente valida. Durante il trascinamento si muove tutta la scritta (inclusi i puntini e le parti sulle due semisfere); l'aggiornamento ricostruisce la geometria alla fine del gesto. Le transizioni tra viste rispettano la preferenza per il movimento ridotto.

L'anello mobile con aggancio/separazione “slime” è una direzione registrata per il futuro aggiornamento dei portachiavi, non una funzione già implementata qui.

## Collegamenti

Nella vista Pezzi sul piatto, Automatico e Sedi sagomate generano guide per testi e simboli. Perni aggiunge un perno integrato sotto ogni componente con spazio sufficiente e la relativa sede nella base; i dettagli sottili mantengono soltanto la sede sagomata. Il gioco è regolabile. Le semisfere usano un incastro continuo lungo il bordo, anche in Automatico. Gli export nella vista separata e gli ZIP dei piatti includono questi collegamenti. Provare il gioco con una stampa prima del modello finale.
