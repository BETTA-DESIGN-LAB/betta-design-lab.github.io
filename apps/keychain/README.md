# Portachiavi e lettere decorative

Le misure del modello Iniziale / Lettera indicano larghezza e altezza reali della lettera, indipendenti. Il contorno viene adattato a entrambe le quote; non sono un riquadro massimo proporzionale. Il nome mantiene la stessa altezza al cambio di font, mentre la sua larghezza segue il carattere. Nome, simboli e anello possono ampliare il corpo: lo stato mostra l’ingombro completo effettivo.

## Basi opzionali

- Sagoma di fondo: contorno pieno allargato sotto lettera e nome, spessore e margine regolabili.
- Piedistallo: sede sagomata ricavata dal contorno inferiore, gioco di 0,25 mm per lato, fondo residuo di almeno 2 mm. Dimensioni adattate al modello; profondità minima e altezza regolabili.
- Le due basi sono indipendenti e combinabili; le scelte restano salvate quando nascoste.

La vista compatta mostra la lettera montata in verticale. Gli export STL/3MF mantengono la lettera piatta e il piedistallo a fianco. La vista Pezzi sul piatto dispone separatamente anche decorazioni e fondo, con sedi/connettori condivisi per le scritte. Il 3MF non impone preset stampante o filamenti.

La stabilità e il gioco reale richiedono una prova fisica sul materiale e sulla stampante scelti. Non è un incastro fisicamente collaudato.

## Verifica

test-keychain-support.ts controlla quote indipendenti, altezza nome su rapporti di font diversi, quattro combinazioni di basi, solidi, assenza di collisioni della sede, disposizione sui piatti ed export. I file della prova browser Greta confermano 36 mm di altezza nome per corsivo, moderno e classico.

## Finitura dei caratteri

I caratteri vengono campionati a 2048 px e tracciati tramite marching squares con interpolazione dell’antialias. Il bordo non segue più i quadratini dei pixel. I contorni, inclusi i fori, vengono semplificati con tolleranza subpixel e riutilizzati dalla cache. La stessa geometria entra in anteprima, sedi e file STL/3MF.
