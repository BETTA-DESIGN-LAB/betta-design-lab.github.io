# Thermoform — prototipo

Generatore originale di otto parti: sagoma piatta fronte, retro speculare, matrice concava, convesso, raccordo filettato, tappo con occhiello perno trasversale e clip inferiore. Forme pronte, SVG esterno unito o profilo XY di uno STL chiuso. Non riproduce la superficie originale degli STL.

Ogni modifica rigenera il kit in un worker. La trama è geometria esplicita, non dipende dall'infill dello slicer. Per contorni asimmetrici ogni stampo contiene due impronte speculari collegate: rimangono due stampi ma occupano più spazio. Il convesso è speculare per combaciare con la matrice dopo un vero capovolgimento attorno a Y.

La bombatura usa un campo di distanza al bordo. La matrice viene liberata anche rispetto alla mesh effettiva del convesso capovolto. Filetto triangolare passo 2 mm, tre giri; gioco e imbocco conico verificati geometricamente durante l'avvitamento. L'accoppiamento delle linguette con il raccordo e la tenuta dopo formatura richiedono prove fisiche: non sono certificati dai test software.

L'anteprima dell'oggetto formato è illustrativa, non una simulazione del materiale. Non viene esportata al posto delle sagome piatte. Export ZIP: otto STL singoli, 3MF divisi su piatti, progetto JSON e istruzioni di montaggio. Nessun preset stampante nei 3MF.

La stampa fisica deve validare il materiale per gli stampi, riscaldamento, assottigliamento, tenuta delle linguette e tolleranza della chiusura. Usare prima un campione piccolo. Tenere il generatore in beta fino al collaudo fisico.

## Guida alla formatura

Il pulsante Istruzioni apre la guida rapida con la sagoma reale e le quote del progetto. Lo ZIP include il PDF illustrato di sette pagine, guida-personalizzata.html e LEGGIMI-montaggio.txt, oltre ai otto STL e ai piatti 3MF. I testi condivisi sono in src/guide-content.json; scripts/create-thermoform-guide.py rigenera il PDF con ReportLab. Le immagini sono schemi generali; formatura e tenuta devono ancora essere validate fisicamente.

## Revisione del 4 novembre 2026

La prova fisica ha rilevato interferenza a freddo nella matrice e sfilamento delle linguette. La matrice ora ha un gioco laterale minimo di 0,65 mm e due inviti per il rilascio. Il raccordo riceve un perno trasversale 3,2 x 11,2 x 1,2 mm, nei fori 4 x 2 mm già presenti sulle linguette. Il tappo impedisce lo sfilamento laterale del perno. La nuova chiusura richiede conferma fisica, non solo verifiche di collisione.

Le illustrazioni del PDF usano i triangoli reali del kit tondo 63 × 71 mm. Rigenerazione: node --experimental-strip-types scripts/export-thermoform-guide.ts, poi python scripts/render-thermoform-guide.py e python scripts/create-thermoform-guide.py. I render richiedono NumPy e Pillow, il PDF ReportLab. Intermedi in tmp/pdfs; nessuna geometria del generatore viene modificata. Le sezioni sono solo illustrative e vengono segnalate nelle didascalie.

Blocco inferiore: due linguette con foro 4 × 2 mm, canali dedicati in entrambi gli stampi e clip a U con denti arrotondati. Clip orientata con il dorso sul piatto; dimensioni dipendenti da spessore e gioco. Nuove sagome e stampi necessari: le sagome precedenti non hanno le linguette inferiori. Raccordo, tappo e perno superiore invariati. La ritenzione elastica richiede collaudo fisico.
