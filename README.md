# Betta Design Lab

Generatori parametrici per stampa 3D che girano interamente nel browser: l'utente
sceglie i parametri, vede l'anteprima 3D e scarica STL o 3MF multicolore.
Nessun server, nessun account, nessun costo per chi usa il sito.

## Avvio in locale (Windows)

Serve [Node.js 22 LTS](https://nodejs.org). Poi, da PowerShell nella cartella del progetto:

```powershell
corepack enable          # attiva pnpm (una volta sola)
pnpm install             # scarica le librerie (una volta, o quando cambiano)
pnpm dev                 # apre il sito su http://localhost:5173
```

Se `corepack enable` dà errore di permessi: `npm install -g pnpm`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm dev` | sito di sviluppo con ricarica automatica |
| `pnpm build` | build di produzione in `dist/` |
| `pnpm preview` | serve `dist/` per una prova finale |
| `pnpm test` | prova ogni combinazione di parametri dei generatori |
| `pnpm typecheck` | controllo dei tipi TypeScript |
| `pnpm new:generator <id> "Nome" "Descrizione" [Categoria]` | crea un nuovo generatore dal template |

## Struttura

```
apps/
  index.html, hub/      catalogo (card generate da generators.json)
  coaster/              generatore sottobicchieri
  _template/            generatore minimo da cui partono i nuovi
packages/
  brand/                nome, link, licenza, palette filamenti (unica fonte)
  ui-kit/               stile e controlli condivisi
  viewer/               anteprima 3D (three.js)
  geometry/             manifold-3d: caricamento WASM, memoria, profili 2D
  export/               STL binario, 3MF multi-oggetto, download
scripts/                test geometria, scaffolding
generators.json         registro di tutti i generatori
```

Librerie: [three.js](https://threejs.org) (MIT), [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0),
[fflate](https://github.com/101arrowz/fflate) (MIT), [Vite](https://vite.dev) (MIT).

## Pubblicazione

Quando c'è una repo GitHub: push su `main` → la action `.github/workflows/deploy.yml` esegue
typecheck, test e build e pubblica `dist/` su GitHub Pages (Settings → Pages → Source: GitHub Actions).

### Collegamenti per parti separate

Coaster, Portachiavi, Keycap (escluso Fidget Clicker) e Scatole mostrano **Collegamento** nella vista separata o di stampa quando esistono decorazioni separabili. Automatico e Sedi sagomate creano guide di montaggio; Perni aggiunge perni integrati e sedi con gioco di 0,15 mm per lato dove c'è materiale sufficiente. I dettagli sottili restano guidati dalle sedi. I collegamenti seguono posizione e superficie delle decorazioni e sono inclusi negli export separati. Verificare il gioco con una stampa di prova.

Fidget Clicker e griglia Gridfinity non mostrano il selettore né ricevono perni aggiuntivi. Gli attacchi MX, le guide di cassetti/coperchi e le code di rondine Gridfinity mantengono la propria geometria e le proprie tolleranze; non vengono sostituiti dai perni delle decorazioni. Vase è monolitico e non espone questo controllo. Natale conserva il suo selettore e la tolleranza regolabile.

### Clicker da STL

Forma → STL personalizzato importa un solido chiuso (ASCII o binario, millimetri, massimo 20 MB/150.000 triangoli). Il taglio orizzontale crea corpo inferiore con sede MX e parte superiore con socket a croce. Posizione XY, scala e altezza del taglio sono regolabili; l’anteprima premuta ricompone la superficie esterna, quella rilasciata mostra la corsa. La stampa conserva i due solidi; il progetto JSON conserva anche lo STL. Gli STL aperti e i tagli senza materiale sufficiente vengono rifiutati. Profilo MX nominale, corsa predefinita 4 mm: gli switch Fllyvly B0F223JY4P sono dichiarati compatibili MX ma senza disegno quotato; calibrare con una prova stampata.

Nei sottobicchieri i pattern incorporati non ricevono sedi/perni aggiuntivi e non mostrano Collegamento. Il selettore è riservato alle decorazioni SVG separabili (anche scritte convertite in tracciati), con verifica automatica dello spazio disponibile; usare SVG come sola sagoma non abilita il selettore per i pattern.

## Immagine → SVG

Il convertitore `image-svg` traccia PNG/JPG/WebP sul dispositivo in un worker. Monocolore o fino a 8 colori semplificati, soglia, inversione, rimozione del colore di sfondo e pulizia delle isole. Contorni pieni con fori, senza bitmap incorporate. Limiti: 10 MB, 40 megapixel, 320 pixel di dettaglio, 18.000 punti e 480 KB di SVG; messaggio esplicito per immagini troppo complesse.

“Usa in un generatore” passa l’SVG nella stessa scheda tramite sessionStorage a coaster, keychain, keycap, box e christmas. Il file resta sul dispositivo e viene validato dal parser SVG della suite. Il trasferimento resta disponibile per 24 ore nella scheda, anche al refresh; un’altra scheda/dispositivo richiede un nuovo trasferimento. Il file scaricato conserva i colori; i generatori applicano i propri colori di stampa. Le sagome richiedono forme connesse.
