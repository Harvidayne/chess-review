Chess Review

**Project:** `chess-review` (GitHub: Harvidayne/chess-review)  
**Parent workspace:** Chessengine  
**Date:** 2026-04-05  
**Audience:** Contributors, deployers, future-you

---

## Executive summary

**Chess Review** is a lightweight web application for reviewing chess games from PGN: users step through moves, see engine-backed quality labels (Divine through Blunder), an evaluation bar and graph, best-move hints with on-board arrows, and can **save a session** to a shareable URL so others open the same game and analysis **without re-running Stockfish**. The design targets **free-tier hosting** by running **Stockfish in the browser (WASM + Web Worker)** and keeping the server as a small persistence API only.

---

## Problem & outcome

| Problem | Outcome |
|--------|---------|
| Sharing annotated games without heavy desktop tools | Copy a `/review/{id}` link; recipient sees board + labels + evals instantly |
| Server cost for engine analysis | Engine runs client-side; server stores JSON + PGN |
| Casual users need chess.com-like cues | Arrows, eval bar, graph, “best move vs played” panel |

---

## Technology stack

| Layer | Choice | Role |
|-------|--------|------|
| UI | **React 19** + **TypeScript** | SPA, routing, state |
| Build | **Vite 8** | Dev server, HMR, production bundle |
| Board | **react-chessboard** | Render FEN, arrows, square styling |
| Rules / PGN | **chess.js** | Parse PGN, legal moves, FEN snapshots, SAN ↔ UCI |
| Engine | **stockfish.js** (Niklas Fiekas build) | WASM in **Web Worker**; UCI over `postMessage` |
| Routing | **react-router-dom** | `/` analyzer, `/review/:shareId` saved sessions |
| API | **Express 5** (`server/index.mjs`) | `POST /api/analysis`, `GET /api/analysis/:id` |
| IDs | **nanoid** | Short `share_id` values |
| Dev orchestration | **concurrently** | Vite + API together in `npm run dev` |
| Deploy (prep) | **render.yaml** | Build `npm run build`, start `npm run start` |

**Not committed to git:** `node_modules/`, `dist/` (install + build on clone or CI).

---

## How it works (architecture)

### 1. Client analysis pipeline

1. User provides **PGN**; **chess.js** loads it and builds a list of **FEN snapshots** (start + after each half-move).
2. A **Stockfish Web Worker** runs **UCI** searches (fixed **depth 12**) **asynchronously** so the UI stays responsive.
3. **Position cache** (FEN key → search result) avoids duplicate engine work when the same position appears again.
4. For each position, the app records **white-perspective eval** and **best move UCI** for the eval graph, bar, and arrows.
5. For each **played** move, the app compares **played line vs engine best line** (centipawn loss) and assigns **exactly one** label using tuned thresholds (most moves land in “Good enough”).
6. **UI:** navigation (first/prev/next/last), **color-coded move list**, **best-move arrow** from current FEN, **suggestion panel** when the move is not “Divine”, eval **bar** and **graph**.

### 2. Shareable sessions

1. After analysis, **POST `/api/analysis`** sends `{ pgn, analysis }` (payload includes `plyEvalWhite`, `bestUciAtPly`, per-move labels and metadata).
2. Server stores a row keyed by **`share_id`** (JSON file under `server/data` locally; **`PERSISTENCE_PATH`** on hosts like Render for durable disk).
3. **GET `/api/analysis/:shareId`** returns the same blob; the app hydrates **read-only** review mode—**no Stockfish** required for viewing.

### 3. Runtime modes

| Command | Behavior |
|---------|----------|
| `npm run dev` | Vite (e.g. :5173) + API (:3001); browser uses Vite **proxy** for `/api` |
| `npm run build` + `npm run start` | Single Node process: **static `dist/`** + API (production-style, one URL) |

### 4. Static assets

**Stockfish** worker + `.wasm` live under **`public/stockfish/`** so the worker can load the binary at a stable path.

---

## Scope notes (brief)

- **In scope:** Single-game PGN MVP, mobile-friendly layout, share links, Render-oriented single-service deploy.
- **Out of scope / future:** Accounts, server-side engine, multi-game PGN picker, database beyond file/disk store unless upgraded.

---

## Distillate (for downstream PRD / agents)

- **Repo:** `chess-review-spike` in Chessengine; pushed to `github.com/Harvidayne/chess-review`.
- **Product type:** Consumer-style chess tool; free-tier friendly; WASM engine + minimal API.
- **Key files:** `src/pages/AnalyzerPage.tsx`, `src/engine/analyzeGame.ts`, `src/engine/stockfishWorker.ts`, `server/index.mjs`, `render.yaml`.
- **Risk:** Ephemeral filesystem on free hosts loses shares unless **`PERSISTENCE_PATH`** points to a mounted disk or external DB.

---

*Anything else you’d like in this brief (personas, metrics, competitive notes), say the word and we can extend it.*
