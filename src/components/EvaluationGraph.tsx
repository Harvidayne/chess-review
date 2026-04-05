type Props = {
  values: number[]
  currentPly: number
  width?: number
  height?: number
}

/** Simple eval-over-game polyline (centipawns, white-positive). */
export function EvaluationGraph({
  values,
  currentPly,
  width = 320,
  height = 72,
}: Props) {
  if (values.length < 2) return null

  const pad = 6
  const w = width - pad * 2
  const h = height - pad * 2
  const min = Math.min(...values, -200)
  const max = Math.max(...values, 200)
  const span = Math.max(max - min, 80)

  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * w
    const y = pad + h - ((v - min) / span) * h
    return `${x},${y}`
  })

  const cx =
    pad + (currentPly / Math.max(values.length - 1, 1)) * w

  return (
    <div className="eval-graph-wrap">
      <svg
        className="eval-graph"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evaluation across the game"
      >
        <rect x={0} y={0} width={width} height={height} className="eval-graph-bg" />
        <polyline
          fill="none"
          className="eval-graph-line"
          strokeWidth="2"
          points={pts.join(' ')}
        />
        <line
          x1={cx}
          x2={cx}
          y1={pad}
          y2={height - pad}
          className="eval-graph-cursor"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}
