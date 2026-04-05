import type { MoveAnalysisDetail } from '../engine/analysisTypes'

function labelClass(label: string): string {
  switch (label) {
    case 'Divine':
      return 'move-tag divine'
    case 'Excellent':
      return 'move-tag excellent'
    case 'Good enough':
      return 'move-tag ok'
    case 'Really?':
      return 'move-tag doubt'
    case 'Blunder':
      return 'move-tag blunder'
    default:
      return 'move-tag'
  }
}

type Props = {
  details: MoveAnalysisDetail[]
  currentPly: number
  onGoToPly: (ply: number) => void
}

export function MoveList({ details, currentPly, onGoToPly }: Props) {
  const rows: { white?: MoveAnalysisDetail; black?: MoveAnalysisDetail }[] = []
  for (let i = 0; i < details.length; i++) {
    const d = details[i]
    const r = Math.floor(i / 2)
    if (!rows[r]) rows[r] = {}
    if (d.color === 'w') rows[r].white = d
    else rows[r].black = d
  }

  return (
    <div className="move-list" role="list">
      {rows.map((pair, ri) => (
        <div key={ri} className="move-list-row">
          {pair.white ? (
            <button
              type="button"
              className={`move-list-mv ${currentPly === pair.white.plyIndex + 1 ? 'active' : ''}`}
              onClick={() => onGoToPly(pair.white!.plyIndex + 1)}
            >
              {ri + 1}. {pair.white.san}{' '}
              <span className={labelClass(pair.white.label)}>({pair.white.label})</span>
            </button>
          ) : null}
          {pair.black ? (
            <button
              type="button"
              className={`move-list-mv ${currentPly === pair.black.plyIndex + 1 ? 'active' : ''}`}
              onClick={() => onGoToPly(pair.black!.plyIndex + 1)}
            >
              {ri + 1}... {pair.black.san}{' '}
              <span className={labelClass(pair.black.label)}>({pair.black.label})</span>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
