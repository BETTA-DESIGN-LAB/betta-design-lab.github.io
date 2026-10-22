# Thermoform — prototipo

Generatore originale di sei parti: sagoma piatta fronte, retro speculare, matrice concava, convesso, raccordo filettato e tappo con occhiello. Forme pronte, SVG esterno unito o profilo XY di uno STL chiuso. Non riproduce la superficie originale degli STL.

Ogni modifica rigenera il kit in un worker. La trama è geometria esplicita, non dipende dall'infill dello slicer. Per contorni asimmetrici ogni stampo contiene due impronte speculari collegate: rimangono due stampi ma occupano più spazio. Il convesso è speculare per combaciare con la matrice dopo un vero capovolgimento attorno a Y.

La bombatura usa un campo di distanza al bordo. La matrice viene liberata anche rispetto alla mesh effettiva del convesso capovolto. Filetto triangolare passo 2 mm, tre giri; gioco e imbocco conico verificati geometricamente durante l'avvitamento. L'accoppiamento delle linguette con il raccordo e la tenuta dopo formatura richiedono prove fisiche: non sono certificati dai test software.

L'anteprima dell'oggetto formato è illustrativa, non una simulazione del materiale. Non viene esportata al posto delle sagome piatte. Export ZIP: sei STL singoli, 3MF divisi su piatti, progetto JSON e istruzioni di montaggio. Nessun preset stampante nei 3MF.

La stampa fisica deve validare il materiale per gli stampi, riscaldamento, assottigliamento, tenuta delle linguette e tolleranza della chiusura. Usare prima un campione piccolo. Tenere il generatore in beta fino al collaudo fisico.
