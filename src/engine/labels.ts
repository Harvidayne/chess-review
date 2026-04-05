import type { MoveLabel } from './types'

/**
 * Centipawn loss (≥ 0, worse for the mover) → exactly one label.
 * Wider bands so most moves land in “Good enough”.
 */
export function labelFromCpLoss(lossCp: number): MoveLabel {
  const x = Math.max(0, lossCp)
  if (x <= 15) return 'Divine'
  if (x <= 60) return 'Excellent'
  if (x <= 150) return 'Good enough'
  if (x <= 400) return 'Really?'
  return 'Blunder'
}
