import type { MoveLabel } from './types'

export type MoveAnalysisDetail = {
  plyIndex: number
  san: string
  color: 'w' | 'b'
  label: MoveLabel
  /** Centipawns lost vs engine best line (0 if Divine / exact best). */
  lossCp: number
  playedUci: string
  bestMoveUci: string | null
  bestMoveSan: string | null
}

export type GameAnalysisPayload = {
  /** v2 adds bestUciAtPly for board arrows; v1 still loadable. */
  version: 1 | 2
  depth: number
  /** White-positive centipawn-like score at each ply (start + after each half-move). */
  plyEvalWhite: number[]
  /** Engine best-move UCI from each position (same length as plyEvalWhite). v2+. */
  bestUciAtPly?: string[]
  moves: MoveAnalysisDetail[]
}
