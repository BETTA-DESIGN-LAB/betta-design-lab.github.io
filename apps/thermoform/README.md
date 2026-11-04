# Thermoform — kit con mezzi filetti integrati

Sei parti: fronte e retro con mezzo collo filettato integrato, stampo concavo, convesso, tappo con occhiello e piccola clip inferiore. Non vengono più esportati raccordo e perno separati.

## Geometria e montaggio

Le due metà del collo sono sezioni complementari della stessa elica (passo 2 mm, tre giri): nessuna specchiatura indipendente che cambi fase o mano del filetto. Ogni semicollo è solidale alla sua rete. Il retro viene orientato per la stampa e riporta la geometria complementare quando capovolto per il montaggio.

Stampa le reti piatte con il semicollo rivolto in alto. Durante la formatura capovolgile: lato del piatto verso l’alto, semicollo verso il basso nell’invito aperto. Il canale della matrice riceve il semicollo e il convesso è aperto nella stessa zona. Non scaldare collo e bordo.

La clip a U è larga 3,8 mm, con pareti da 0,8 mm; segue lo spessore della rete e il gioco scelto. Denti arrotondati nelle sedi del bordo. La chiusura elastica richiede una prova fisica: i controlli geometrici non certificano lo sforzo di montaggio.

## Forme e stampa

Sagome pronte, contorno SVG esterno unito o profilo XY di uno STL chiuso. La superficie originale dello STL non viene riprodotta. I vuoti interni del profilo sono riempiti per la formatura. Trama esplicita nella geometria, non dipendente dall’infill dello slicer.

Per sagome asimmetriche, due impronte speculari sullo stesso stampo. Il cuore mantiene il collo sul lobo, lasciando libera la V. Sagome, stampi e chiusure si rigenerano in un worker; l’anteprima formata è indicativa.

Export ZIP: sei STL, piatti 3MF, progetto JSON, istruzioni personalizzate e PDF illustrato di sei pagine. Nessun preset macchina o filamento imposto.

## Compatibilità

Questa revisione sostituisce il sistema con raccordo e perno: richiede nuove reti, stampi, tappo e clip. Non mischiare pezzi di revisioni differenti. La versione precedente è conservata in backups/thermoform-before-integrated-thread e nella cronologia GitHub.

## Controlli e guida

scripts/test-thermoform.ts verifica kit, corpi chiusi e uniti, appoggio, stampi abbinati, continuità delle mezze filettature, percorso elicoidale del tappo, ritenzione di entrambe le metà, rilascio a freddo e clip su nove combinazioni spessore/gioco. SVG e STL inclusi.

Illustrazioni ricavate dai triangoli reali del kit tondo 63 × 71 mm. Rigenerazione:
- node --experimental-strip-types scripts/export-thermoform-guide.ts
- python scripts/render-thermoform-guide.py
- python scripts/create-thermoform-guide.py

Render NumPy/Pillow, impaginazione ReportLab; intermedi in tmp/pdfs. Le sezioni servono soltanto alle illustrazioni, gli stampi esportati sono interi.

Ispirazione funzionale: Thermoformed Kawaii Christmas Tree di GoldenPants su MakerWorld. Geometrie Betta Design Lab originali, nessun file del modello copiato. Collaudo fisico del nuovo sistema ancora necessario.
