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
- **File browser:** implementato `FileBrowser` client in `components/` con espansione cartelle on-demand.
- **Metadata:** integrata la lettura dei tag audio server-side con `music-metadata` (gestisce mp3, flac, m4a, wav).
- **Autenticazione minima:** backend JWT + `bcryptjs` (file-based users in `data/users.json`), rotte `/api/auth/*` presenti (signup/login/logout/me).
- **Protezione API:** le API `/api/mp3` e `/api/mp3/fileinfo` richiedono autenticazione via cookie `token`.
- **UI base auth:** pagine client per `/login` e `/signup` aggiunte; header globale mostra utente e logout.
- **Tipi TS:** aggiunti tipi dev `@types/jsonwebtoken` per miglior compatibilità TypeScript.

## Note operative / next steps
- Impostare le variabili d'ambiente in sviluppo: `MP3_DIR` (root dei file audio) e `AUTH_SECRET` (sostituire il valore di default per produzione).
- Riavviare il dev server dopo modifiche agli import o install di tipizzazioni (Turbopack può cacheare moduli):

```bash
rm -rf .next
npm run dev
```

- Prossime funzionalità consigliate: proteggere client routes (redirect se non autenticato), UI per modifica/salvataggio tag (server-side write), e migrazione user store da JSON a DB per produzione.

## Struttura iniziale progetto
- /pages (o /app)
- /api/mp3 — API per lista, upload, tag, ecc.
- /components — Componenti React (es. Mp3List, Mp3TagEditor)
- /lib — Funzioni utili (es. wrapper node-id3)
- /public — Assets statici

## Prossimi passi
- Definire API per gestione file/tag
- Creare UI base per lista e modifica tag mp3

---
Aggiungi qui altre idee o preferenze!