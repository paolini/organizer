<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Organizer — guida al codice

Web app per organizzare una libreria musicale su un server: navigazione a cartelle, modifica dei tag audio e delle copertine, player, anteprima di immagini e testi, operazioni sui file, gestione utenti. Next.js 16 (app router + due route nel pages router), React 19, TypeScript. Niente database: gli utenti stanno in `data/users.json`, i file nella cartella `TARGET_DIR`.

Per l'uso e il deploy vedi il [README](README.md). Qui sotto: come è fatto il codice e le regole da rispettare quando lo si modifica.

## Mappa dei file

```
app/
  page.tsx                 pagina principale: monta <FileBrowser />
  layout.tsx, globals.css  header, layout a tutta altezza, tutti gli stili (CSS puro con variabili, tema chiaro/scuro)
  login/ signup/ account/ users/   pagine di accesso, cambio password, gestione utenti (solo admin)
  api/
    _lib/auth.ts           utenti, sessioni JWT, permessi, limite tentativi di login
    _lib/paths.ts          resolveInRoot() e isValidName(): validazione dei path (vedi Sicurezza)
    _lib/trash.ts          cestino: sposta, elenca, ripristina, elimina, scadenza automatica
    auth/                  login, logout, me, signup, password
    users/, users/[id]/    CRUD utenti (solo admin)
    mp3/route.ts           elenco di una cartella (non ricorsivo)
    mp3/fileinfo           dimensione, estensione e tag (music-metadata) di un file
    mp3/download           download o visualizzazione inline (?inline=1), con supporto Range
    mp3/upload, mkdir, move, rename, convert (FLAC → MP3 con ffmpeg)
    mp3/delete             sposta nel cestino (non cancella)
    trash/, trash/restore, trash/purge   elenco, ripristino, eliminazione definitiva (purge solo admin)
pages/api/mp3/
  bulk-genre.ts            scrittura tag su file e cartelle (node-id3); nome storico, scrive tutti i tag
  cover.ts                 copertina incorporata negli MP3 (formidable + ffmpeg)
components/
  Header.tsx               navigazione, utente corrente
  Toast.tsx                notifiche (ToastProvider / useToast)
  ConfirmDialog.tsx        dialog di conferma per azioni distruttive
  permissions.ts           etichette dei permessi, generatore di password
  FileBrowser/
    index.tsx              stato centrale e orchestrazione dei tre pannelli + player
    FolderTree.tsx         albero delle sole cartelle (senza stato proprio)
    FileTable.tsx          contenuto della cartella corrente: selezione, tastiera, drag & drop, rinomina inline
    Toolbar.tsx            percorso e azioni (carica, nuova cartella, sposta, rinomina, elimina)
    DetailsPanel.tsx       pannello destro: una vista per cartella, audio, immagine, testo, altro, selezione multipla
    TagEditor.tsx          form dei tag e upload copertina
    MoveDialog.tsx         scelta della cartella di destinazione
    Player.tsx             barra di riproduzione
    TrashView.tsx          vista del cestino (sostituisce tabella e dettagli quando si apre il Cestino)
    api.ts                 tutte le chiamate HTTP del client
    dnd.ts                 formato del drag & drop interno e controllo delle destinazioni valide
    types.ts               tipi e utility sui path (joinPath, parentOf, ancestorsOf)
lib/fileTypes.ts           tipo di file per estensione (audio/immagine/testo/altro) e MIME; usato da client e server
```

## File browser

**Layout:** tre colonne (albero, tabella, dettagli) in una griglia CSS, più la barra del player in fondo quando è attiva. Sotto i 760 px diventano schede (Cartelle / File / Dettagli). Il player sta fuori dai pannelli, così non viene smontato quando su mobile si cambia scheda.

**Stato in `index.tsx`:**

- `fileTree: Record<string, Node[] | null>`: chiave = path della cartella (`""` è la radice), valore = figli, oppure assente/`null` se non ancora caricata. È la cache di tutte le cartelle visitate, condivisa da albero, tabella e dialog di spostamento.
- `currentDir`: cartella mostrata nella tabella.
- `expanded: Set<string>`: cartelle aperte nell'albero.
- `selection: Set<string>`: **path** degli elementi selezionati (stringhe, non oggetti). Contiene solo elementi della cartella corrente e viene svuotata quando si cambia cartella. Il tipo (file/cartella) si ricava da `entries`.
- `player: { queue, index }`: la coda è l'elenco dei brani della cartella da cui è partita la riproduzione.

**Ricaricamento:** ogni operazione passa da `run(fn, messaggio)`, che gestisce lo stato "occupato", mostra la notifica di esito e chiama `reloadAll()`. Quest'ultima rilegge tutte le cartelle in cache e scarta in silenzio quelle che non esistono più (rinominate, spostate, eliminate). Se sparisce `currentDir`, risale alla cartella padre. `refreshKey` forza il pannello dettagli a rileggere tag e anteprime.

**Errori:** le API restituiscono `{ error }` con uno stato HTTP di errore, oppure `{ results: [{ file, ok, error? }] }` per le operazioni su più elementi. `api.ts` trasforma entrambi i casi in eccezioni (`checkResults`), che `run` mostra come notifica. Non usare `alert()`.

**Stabilità del layout:** la toolbar deve avere sempre la stessa altezza. Un pulsante che compare in base alla selezione può mandarla a capo, spostare la tabella e far finire il secondo click di un doppio click sulla riga sbagliata. Le azioni che dipendono dalla selezione (per esempio la conversione dei FLAC) vanno nel pannello dettagli.

## Cestino

- **Struttura:** `.trash/<id>/` nella radice della libreria contiene l'elemento eliminato (con il nome originale) e `.meta.json` (path originale, tipo, data, utente, dimensione). L'id è `<ms epoch>-<8 hex>`: la data serve per la scadenza, la regex sull'id impedisce il path traversal.
- **Navidrome:** `.trash/.ndignore` (file vuoto) fa sì che Navidrome ignori la cartella.
- **Ripristino:** l'elemento torna al path originale, ricreando le cartelle mancanti. Se il nome è occupato aggiunge " (2)", " (3)"…
- **Scadenza:** dopo `TRASH_DAYS` giorni (default 30) gli elementi vengono eliminati, al primo elenco o alla prima eliminazione successiva.
- **Interfaccia:** eliminare non chiede conferma, la notifica offre "Annulla". Si può anche trascinare sul Cestino nell'albero. La conferma resta per l'eliminazione definitiva.

## Autenticazione e permessi

- **Permessi:** `read` (vedere, scaricare), `write` (tutte le modifiche ai file e ai tag), `admin` (gestione utenti).
- **Controllo nelle route dell'app router:** `const user = await authorize(req, 'write'); if (user instanceof NextResponse) return user;`.
- **Route del pages router** (`bulk-genre`, `cover`): usano `getUserFromReq` più il controllo manuale dei permessi.
- **Sessione:** cookie `token` con un JWT di 7 giorni che contiene `username` e `issuedAtMs`. Ogni richiesta rilegge `users.json`, quindi cambiare permessi o eliminare un utente ha effetto subito. Un token emesso prima di `passwordChangedAt` non vale più: è così che il cambio password chiude le altre sessioni.
- **Scrittura di `users.json`:** solo tramite `updateUsers(fn)`, che mette in fila le modifiche concorrenti.
- **Admin sempre presente:** un admin non può togliersi il ruolo `admin` né eliminarsi, così ne resta sempre almeno uno.
- **Registrazione:** chiusa salvo `ALLOW_SIGNUP=true`. Il primo utente di un'installazione vuota diventa admin.

## Sicurezza: regole per le API sui file

- **Permessi:** ogni route deve controllare il permesso giusto. Le letture richiedono `read`, tutto ciò che modifica richiede `write`.
- **Path:** ogni path ricevuto dal client va risolto con `resolveInRoot(rootDir, rel)`, che restituisce `null` se esce da `TARGET_DIR` o se punta dentro `.trash` (al cestino si accede solo da `_lib/trash.ts`). Con il terzo argomento a `false` rifiuta anche la radice stessa: usarlo per rinominare, spostare, eliminare e convertire. Non usare `path.join(root, rel)` né il controllo con `startsWith(root)`, che considera valida `/music2` quando la radice è `/music`.
- **Nomi nuovi** (rinomina, nuova cartella): vanno validati con `isValidName`.
- **Sovrascritture:** nessuna operazione deve sovrascrivere un file esistente senza dirlo. `fs.rename` sovrascrive in silenzio, quindi va controllata prima l'esistenza della destinazione.
- **Contenuti serviti al browser:** `download` invia sempre `X-Content-Type-Options: nosniff` e `Content-Security-Policy: sandbox`. In linea vengono serviti solo i tipi elencati in `lib/fileTypes.ts`, e il testo sempre come `text/plain`. In questo modo un SVG o un HTML caricato da un utente non può eseguire script con l'origine dell'app.

## Tag audio

- **Lettura:** `music-metadata` in `fileinfo`. Restituisce `tags.common` (title, artist, albumArtist, album, year, `track: { no, of }`, `genre: string[]`), `pictures` (in base64) e `format`.
- **Scrittura:** `node-id3` in `bulk-genre`, **solo MP3**; per i FLAC restituisce un errore. Se un elemento è una cartella, scrive su tutti gli audio che contiene, sottocartelle comprese. I campi vuoti vengono ignorati, quindi oggi non si può cancellare un tag. Più generi si separano con `;`.

## Sviluppo

- **Avvio:** `npm run dev` con `TARGET_DIR` e `AUTH_SECRET` in `.env.local`.
- **Prima del commit:** `npx tsc --noEmit -p .` e `npx eslint`. Restano errori `no-explicit-any` già presenti in `convert`, `fileinfo` e `mkdir`, e i warning `no-img-element` sulle anteprime, che sono voluti: si tratta di immagini dinamiche o in base64.
- **Prove manuali:** usare una copia del progetto con una `TARGET_DIR` e un `data/users.json` di prova. Non usare la libreria reale né gli utenti reali.
- **Rilascio:** il push su `main` pubblica l'immagine Docker `paolini/organizer:<versione di package.json>`, quindi la versione va alzata prima del push.
- **Dati da non committare:** `data/users.json` contiene gli hash delle password ed è nel `.gitignore`.
