type Props = {
  /** White-positive centipawns (mate uses large proxy from engine). */
  evalCp: number
  className?: string
}

/** Vertical bar: more white at bottom when White is better (chess.com-style). */
export function EvaluationBar({ evalCp, className }: Props) {
  const pawns = evalCp / 100
  const t = Math.tanh(pawns / 4)
  const whiteRatio = Math.min(0.97, Math.max(0.03, (t + 1) / 2))
  const blackRatio = 1 - whiteRatio

  const label =
    Math.abs(evalCp) >= 9000
      ? evalCp > 0
        ? 'M+'
        : 'M-'
      : `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`

  return (
    <div className={`eval-bar ${className ?? ''}`} aria-label={`Evaluation about ${label} pawns for White`}>
      <div className="eval-bar-inner">
        <div className="eval-bar-black" style={{ height: `${blackRatio * 100}%` }} />
        <div className="eval-bar-white" style={{ height: `${whiteRatio * 100}%` }} />
      </div>
      <div className="eval-bar-caption">{label}</div>
    </div>
  )
}
