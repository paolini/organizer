### Altro esempio

{
	"common": {
		"title": "Alice",
		"artist": "Francesco De Gregori",
		"album": "Alice non lo sa",
		"year": 1973,
		"track": {
			"no": 1,
			"of": 12
		},
		"genre": "Italiana; Folk"
	},
	"pictures": [
		{
			"mime": "image/jpeg",
			"description": null,
			"size": 60462
		}
	],
	"format": {
		"container": "MPEG",
		"codec": "MPEG 1 Layer 3",
		"sampleRate": 44100
	}
}
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Scelta tecnologia per interfaccia web gestione/tag mp3

## Obiettivo
Creare una web app per gestire e taggare file mp3.

## Requisiti principali
- Visualizzazione lista file mp3
- Modifica/aggiunta tag (ID3)
- Upload/download file
- Interfaccia user-friendly
- Possibilità di ricerca e filtro

## Stack scelto
- **Framework:** Next.js (React + TypeScript)
- **Backend/API:** Next.js API routes (Node.js)
- **Libreria ID3:** node-id3 (lettura/scrittura tag, immagini, promesse)
- **Storage:** File system locale

## Stato attuale (aggiornamento)

## Struttura dati file browser

	Oggetto React state di tipo `Record<string, Node[] | null>`.  
	- Chiave: percorso della cartella ("" per la root, oppure "subdir", "subdir/nome", ecc.)
	- Valore: array di nodi figli (`Node[]`) se la cartella è stata caricata, `null` se la cartella è vuota o non ancora caricata.

	```ts
	type Node = {
		name: string; // nome file o cartella
		type: "file" | "directory";
	}
	```

	`Set<string>`  
	Contiene i path completi dei file selezionati. Solo i file sono tracciati, non le cartelle.

	```ts
	type FileInfoData = {
		size: number;
		ext: string;
		tags?: Record<string, unknown>;
	}
	```
	Usato per mostrare info/tag di un file.


### Esempio di informazioni visualizzate su un file audio

{
	"common": {
		"title": "Human Behaviour",
		"artist": "Björk",
		"album": "Debut",
		"year": 1993,
		"track": {
			"no": 1,
			"of": null
		},
		"genre": "Alternative"
	},
	"pictures": [
		{
			"mime": "image/jpeg",
			"description": null,
			"size": 455677
		}
	],
	"format": {
		"container": "FLAC",
		"codec": "FLAC",
		"sampleRate": 44100
	}
}

	Funzione ricorsiva che, dato un array di nodi e un path di base, restituisce tutti i path dei file contenuti (anche nelle sottocartelle).

- **File browser:**
	- Implementato `FileBrowser` client in `components/` con espansione cartelle on-demand e selezione ricorsiva di file/folder.
	- Stato centralizzato: la struttura delle cartelle (`fileTree`) è mantenuta in un unico oggetto React state, che distingue tra cartelle vuote, non caricate e popolate.
	- Selezione ricorsiva: la selezione/deselezione di una cartella seleziona tutti i file contenuti (anche nelle sottocartelle) e aggiorna lo stato dei checkbox (checked/indeterminate) in modo coerente.
	- Solo i file sono tracciati nello stato di selezione, non le cartelle.
	- Fixati bug di runtime (es. accesso a cartelle root non inizializzate, errori React sui componenti e sugli hook).
	- UI aggiornata: lo stato checked/indeterminate delle cartelle riflette la selezione effettiva dei file figli.
- **Metadata:** lettura tag audio server-side con `music-metadata` (mp3, flac, m4a, wav). Scrittura tag mp3 con `node-id3` asincrona (`update`).
- **Autenticazione minima:** backend JWT + `bcryptjs` (file-based users in `data/users.json`), rotte `/api/auth/*` (signup/login/logout/me).
- **Protezione API:** le API `/api/mp3` e `/api/mp3/fileinfo` richiedono autenticazione via cookie `token`.
- **UI base auth:** pagine client per `/login` e `/signup`; header globale mostra utente e logout.
- **Tipi TS:** aggiunti tipi dev `@types/jsonwebtoken` per miglior compatibilità TypeScript.
- **Compatibilità API:** le funzioni di autenticazione ora accettano sia `NextApiRequest` che `Request` (compatibile pages/api e app router).

## Note operative / next steps
- Impostare le variabili d'ambiente in sviluppo: `TARGET_DIR` (root dei file audio) e `AUTH_SECRET` (sostituire il valore di default per produzione).

Per sviluppo: riavviare il dev server dopo modifiche agli import o install di tipizzazioni (Turbopack può cacheare moduli):

```bash
rm -rf .next
npm run dev
```

Per produzione:

```bash
npm run build
npm start
```

- Prossime funzionalità consigliate: proteggere client routes (redirect se non autenticato), UI per modifica/salvataggio tag (server-side write), e migrazione user store da JSON a DB per produzione.
- Bug risolti: gestione compatibilità API, scrittura tag mp3 asincrona, validazione parametri API aggiornata.

## Struttura iniziale progetto
- /pages (o /app)
- /api/mp3 — API per lista, upload, tag, ecc.
- /components — Componenti React (es. Mp3List, Mp3TagEditor)
- /lib — Funzioni utili (es. wrapper node-id3)
- /public — Assets statici

## Prossimi passi
- Definire API per gestione file/tag
- Creare UI base per lista e modifica tag mp3

### Conversione FLAC → MP3

- Aggiunto pulsante "Converti in MP3" nella UI:
  - Appare nei dettagli di un file FLAC (popup info) e sotto il bulk editor se nella selezione ci sono FLAC.
  - Permette la conversione multipla di tutti i FLAC selezionati.
- API route `/api/mp3/convert`:
  - Accetta una lista di file FLAC (relativi alla root audio) e li converte in MP3 usando `fluent-ffmpeg` lato server.
  - Restituisce l’esito per ogni file (ok/errore).
- Dipendenza: richiede `fluent-ffmpeg` (npm) e ffmpeg installato sul sistema.
- Build e test superati con Next.js 16/Turbopack.

- Conversione FLAC→MP3:
  - Installa la dipendenza: `npm install fluent-ffmpeg`
  - Assicurati che `ffmpeg` sia installato nel sistema (`ffmpeg -version`)
  - La conversione avviene nella stessa cartella del file sorgente.
  - La route API `/api/mp3/convert` accetta `{ files: ["path/file.flac", ...] }` o `{ path: "file.flac" }`.
  - In caso di warning Turbopack su path/fs, vedi log build: non bloccante.

- Migliorare feedback UI post-conversione (refresh lista, download diretto, ecc.)
- Gestione errori conversione più dettagliata lato client