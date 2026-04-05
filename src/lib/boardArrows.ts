import type { Arrow } from 'react-chessboard'

/** Engine best-move UCI → single arrow (chess.com-style hint). */
export function bestUciToArrows(uci: string | undefined | null): Arrow[] {
  if (!uci || uci === '(none)' || uci.length < 4) return []
  const startSquare = uci.slice(0, 2)
  const endSquare = uci.slice(2, 4)
  return [
    {
      startSquare,
      endSquare,
      color: 'rgba(46, 204, 113, 0.95)',
    },
  ]
}
