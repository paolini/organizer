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