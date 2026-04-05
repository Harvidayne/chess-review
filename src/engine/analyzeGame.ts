import { Chess, type Move } from 'chess.js'
import { toWhitePov, type StockfishEngine } from './stockfishWorker'
import { labelFromCpLoss } from './labels'
import type { MoveLabel } from './types'
import type { GameAnalysisPayload, MoveAnalysisDetail } from './analysisTypes'
import { uciToSan } from '../lib/uci'

/** Fixed depth for WASM analysis (non-blocking — runs in worker). */
export const ANALYSIS_DEPTH = 12

export type GameHeaders = Record<string, string>

function moveToUci(m: Move): string {
  let u = `${m.from}${m.to}`
  if (m.promotion) u += m.promotion
  return u
}

export function loadPgnOrThrow(pgn: string): { headers: GameHeaders; moves: Move[] } {
  const chess = new Chess()
  try {
    chess.loadPgn(pgn.trim(), { strict: false, newlineChar: '\n' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid PGN'
    throw new Error(`PGN validation failed: ${msg}`)
  }
  const moves = chess.history({ verbose: true })
  if (moves.length === 0) {
    throw new Error('PGN validation failed: no moves found (check headers and move text).')
  }
  return { headers: chess.getHeaders(), moves }
}

/** FEN after each half-move: [start, after ply1, …]. */
export function buildFenSnapshots(moves: Move[]): string[] {
  const c = new Chess()
  const out: string[] = [c.fen()]
  for (const m of moves) {
    c.move(m)
    out.push(c.fen())
  }
  return out
}

/**
 * Full analysis: cached searches per position, then per-move loss vs best line.
 */
export async function analyzeGame(
  moves: Move[],
  snapshots: string[],
  engine: StockfishEngine,
  onProgress?: (phase: string, done: number, total: number) => void,
): Promise<GameAnalysisPayload> {
  const n = moves.length
  const plyEvalWhite: number[] = []
  const bestUciAtPly: string[] = []

  onProgress?.('Positions', 0, snapshots.length)
  for (let k = 0; k < snapshots.length; k++) {
    const r = await engine.searchPosition(snapshots[k], ANALYSIS_DEPTH)
    plyEvalWhite.push(toWhitePov(snapshots[k], r))
    bestUciAtPly.push(r.bestmove && r.bestmove !== '(none)' ? r.bestmove : '')
    onProgress?.('Positions', k + 1, snapshots.length)
  }

  const details: MoveAnalysisDetail[] = []

  onProgress?.('Moves', 0, n)
  for (let i = 0; i < n; i++) {
    const fenPrev = snapshots[i]
    const played = moveToUci(moves[i])
    const mover = moves[i].color
    const san = moves[i].san
    const best = bestUciAtPly[i]

    let label: MoveLabel = 'Good enough'
    let lossCp = 0
    let bestMoveUci: string | null = null
    let bestMoveSan: string | null = null

    if (!best || best === '(none)') {
      label = 'Good enough'
      lossCp = 0
    } else if (best === played) {
      label = 'Divine'
      lossCp = 0
      bestMoveUci = null
      bestMoveSan = null
    } else {
      bestMoveUci = best
      bestMoveSan = uciToSan(fenPrev, best)

      const c = new Chess(fenPrev)
      const from = best.slice(0, 2) as Move['from']
      const to = best.slice(2, 4) as Move['to']
      const promotion = (best.length > 4 ? best[4] : undefined) as Move['promotion'] | undefined
      const ok = c.move({ from, to, promotion })
      if (!ok) {
        label = 'Good enough'
        lossCp = 0
      } else {
        const fenBest = c.fen()
        const rBest = await engine.searchPosition(fenBest, ANALYSIS_DEPTH)
        const evBest = toWhitePov(fenBest, rBest)
        const evPlayed = plyEvalWhite[i + 1]
        const rawLoss = mover === 'w' ? evBest - evPlayed : evPlayed - evBest
        lossCp = Math.max(0, rawLoss)
        label = labelFromCpLoss(lossCp)
      }
    }

    details.push({
      plyIndex: i,
      san,
      color: mover,
      label,
      lossCp,
      playedUci: played,
      bestMoveUci,
      bestMoveSan,
    })
    onProgress?.('Moves', i + 1, n)
  }

  return {
    version: 2,
    depth: ANALYSIS_DEPTH,
    plyEvalWhite,
    bestUciAtPly,
    moves: details,
  }
}
