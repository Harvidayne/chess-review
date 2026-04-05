import { Chess, type Move, type Square } from 'chess.js'

export function uciToSan(fen: string, uci: string): string {
  if (!uci || uci === '(none)') return uci
  const c = new Chess(fen)
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const promotion = (uci.length > 4 ? uci[4] : undefined) as Move['promotion'] | undefined
  const m = c.move({ from, to, promotion })
  return m ? m.san : uci
}
