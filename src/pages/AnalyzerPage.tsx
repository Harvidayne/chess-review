import { useCallback, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import {
  buildFenSnapshots,
  loadPgnOrThrow,
  analyzeGame,
} from '../engine/analyzeGame'
import { getStockfish, disposeStockfish } from '../engine/stockfishWorker'
import { bestUciToArrows } from '../lib/boardArrows'
import type { GameAnalysisPayload } from '../engine/analysisTypes'
import { EvaluationBar } from '../components/EvaluationBar'
import { EvaluationGraph } from '../components/EvaluationGraph'
import { MoveList } from '../components/MoveList'
import { saveAnalysis } from '../api/client'
import '../App.css'

const EXAMPLE_PGN = `[Event "Example Game"]
[Site "?"]
[Date "2024.01.01"]
[Round "-"]
[White "Player A"]
[Black "Player B"]

1. e4 e5
2. Nf3 Nc6
3. Bb5 a6
4. Ba4 Nf6
5. O-O Be7
6. Re1 b5
7. Bb3 d6
8. c3 O-O
9. h3`

type Props = {
  /** Hydrate from server (review link) — no Stockfish, no PGN edit. */
  initialPgn?: string
  initialAnalysis?: GameAnalysisPayload
  readOnly?: boolean
}

function headerBlock(h: Record<string, string>) {
  const keys = ['White', 'Black', 'Event', 'Date'] as const
  return keys.map((k) => {
    const v = h[k]
    return v ? (
      <div key={k} className="header-tag">
        <span className="header-tag-k">{k}</span>
        <span className="header-tag-v">{v}</span>
      </div>
    ) : null
  })
}

export function AnalyzerPage({
  initialPgn,
  initialAnalysis,
  readOnly = false,
}: Props) {
  const navigate = useNavigate()
  const [pgnText, setPgnText] = useState(initialPgn ?? EXAMPLE_PGN)
  const [error, setError] = useState<string | null>(null)
  const [plyIndex, setPlyIndex] = useState(0)
  const [analysis, setAnalysis] = useState<GameAnalysisPayload | null>(
    initialAnalysis ?? null,
  )
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState('')
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [savedShareId, setSavedShareId] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareErr, setShareErr] = useState<string | null>(null)

  const parsed = useMemo(() => {
    try {
      const { headers, moves } = loadPgnOrThrow(pgnText)
      const snapshots = buildFenSnapshots(moves)
      return { ok: true as const, headers, moves, snapshots }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid PGN'
      return { ok: false as const, error: msg }
    }
  }, [pgnText])

  const fen =
    parsed.ok && parsed.snapshots[plyIndex]
      ? parsed.snapshots[plyIndex]
      : new Chess().fen()

  const maxPly = parsed.ok ? parsed.moves.length : 0
  const currentEval =
    analysis && analysis.plyEvalWhite.length > plyIndex
      ? analysis.plyEvalWhite[plyIndex]
      : 0

  const currentDetail =
    analysis && plyIndex > 0 ? analysis.moves[plyIndex - 1] : null

  const boardArrows = useMemo(() => {
    if (!analysis?.bestUciAtPly?.length) return []
    const uci = analysis.bestUciAtPly[plyIndex]
    return bestUciToArrows(uci)
  }, [analysis, plyIndex])

  const runAnalysis = useCallback(async () => {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError(null)
    setShareLink(null)
    setSavedShareId(null)
    setShareErr(null)
    setAnalyzing(true)
    setAnalysis(null)
    setProgress('Starting engine…')
    try {
      const engine = await getStockfish()
      engine.clearCache()
      const payload = await analyzeGame(
        parsed.moves,
        parsed.snapshots,
        engine,
        (phase, done, total) =>
          setProgress(`${phase}: ${done} / ${total}`),
      )
      setAnalysis(payload)
      setProgress('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setProgress('')
    } finally {
      setAnalyzing(false)
    }
  }, [parsed])

  const copyShare = useCallback(async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {
      /* ignore */
    }
  }, [shareLink])

  const saveShare = useCallback(async () => {
    if (!parsed.ok || !analysis) return
    setShareBusy(true)
    setShareErr(null)
    try {
      const { share_id } = await saveAnalysis(pgnText, analysis)
      setSavedShareId(share_id)
      const path = `/review/${share_id}`
      setShareLink(`${window.location.origin}${path}`)
    } catch (e) {
      setShareErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setShareBusy(false)
    }
  }, [parsed, analysis, pgnText])

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <h1>Chess review</h1>
          {readOnly ? (
            <Link to="/" className="link-home-header">
              New analysis
            </Link>
          ) : null}
        </div>
        <p className="sub">
          Lightweight analysis · WASM Stockfish · shareable sessions
        </p>
      </header>

      <div className="headers-above-board">
        {parsed.ok ? headerBlock(parsed.headers) : null}
      </div>

      <div className="layout">
        {!readOnly ? (
          <>
            <div className="pgn-desktop">
              <label className="label" htmlFor="pgn">
                PGN
              </label>
              <textarea
                id="pgn"
                className="pgn-input"
                value={pgnText}
                onChange={(e) => {
                  setPgnText(e.target.value)
                  setAnalysis(null)
                  setPlyIndex(0)
                  setError(null)
                  setShareLink(null)
                  setSavedShareId(null)
                }}
                spellCheck={false}
                rows={12}
              />
            </div>
            <div className="pgn-mobile">
              <span className="label">PGN</span>
              <p className="pgn-mobile-hint">Tap the box to expand and edit</p>
              <textarea
                className="pgn-input pgn-input-mobile"
                value={pgnText}
                onChange={(e) => {
                  setPgnText(e.target.value)
                  setAnalysis(null)
                  setPlyIndex(0)
                  setError(null)
                  setShareLink(null)
                  setSavedShareId(null)
                }}
                spellCheck={false}
                rows={12}
                aria-label="PGN input"
              />
            </div>
          </>
        ) : (
          <p className="read-only-note">Saved review — analysis loaded from the server.</p>
        )}

        <section className="board-column">
          {!parsed.ok ? (
            <p className="meta error banner-error">{parsed.error}</p>
          ) : null}

          <div className="board-and-bar">
            <EvaluationBar evalCp={currentEval} className="eval-bar-side" />
            <div className="board-wrap">
              <Chessboard
                options={{
                  id: 'main-board',
                  position: fen,
                  boardOrientation: 'white',
                  allowDragging: false,
                  allowDrawingArrows: false,
                  arrows: boardArrows,
                  lightSquareStyle: { backgroundColor: '#ffffff' },
                  darkSquareStyle: { backgroundColor: '#4a7c59' },
                }}
              />
            </div>
          </div>

          {analysis ? (
            <EvaluationGraph
              values={analysis.plyEvalWhite}
              currentPly={plyIndex}
              width={Math.min(420, typeof window !== 'undefined' ? window.innerWidth - 48 : 360)}
              height={80}
            />
          ) : null}

          <div className="nav nav-touch">
            <button
              type="button"
              className="btn nav-btn"
              disabled={plyIndex <= 0}
              onClick={() => setPlyIndex(0)}
              aria-label="First move"
            >
              |◀
            </button>
            <button
              type="button"
              className="btn nav-btn"
              disabled={plyIndex <= 0}
              onClick={() => setPlyIndex((i) => Math.max(0, i - 1))}
              aria-label="Previous move"
            >
              ◀
            </button>
            <span className="ply">
              Ply {plyIndex} / {maxPly}
            </span>
            <button
              type="button"
              className="btn nav-btn"
              disabled={plyIndex >= maxPly}
              onClick={() => setPlyIndex((i) => Math.min(maxPly, i + 1))}
              aria-label="Next move"
            >
              ▶
            </button>
            <button
              type="button"
              className="btn nav-btn"
              disabled={plyIndex >= maxPly}
              onClick={() => setPlyIndex(maxPly)}
              aria-label="Last move"
            >
              ▶|
            </button>
          </div>

          {currentDetail ? (
            <div className="label-box" data-label={currentDetail.label}>
              <span className="label-tag">This move</span>
              <span className="label-value">
                {analyzing ? '…' : currentDetail.label}
              </span>
            </div>
          ) : (
            <div className="label-box" data-label="—">
              <span className="label-tag">This move</span>
              <span className="label-value">—</span>
            </div>
          )}

          {currentDetail && currentDetail.label !== 'Divine' ? (
            <div className="best-feedback">
              <div>
                <span className="bf-k">Move played</span>{' '}
                <span className="bf-v">{currentDetail.san}</span>
              </div>
              <div>
                <span className="bf-k">Best move</span>{' '}
                <span className="bf-v">
                  {currentDetail.bestMoveSan ?? '—'}
                </span>
              </div>
              <div>
                <span className="bf-k">Evaluation loss</span>{' '}
                <span className="bf-v">
                  {(currentDetail.lossCp / 100).toFixed(1)}
                </span>
              </div>
            </div>
          ) : null}

          {analysis ? (
            <MoveList
              details={analysis.moves}
              currentPly={plyIndex}
              onGoToPly={setPlyIndex}
            />
          ) : null}
        </section>
      </div>

      {!readOnly && parsed.ok ? (
        <div className="actions actions-footer">
          <button
            type="button"
            className="btn primary"
            disabled={analyzing}
            onClick={runAnalysis}
          >
            {analyzing ? 'Analyzing…' : 'Analyze with Stockfish'}
          </button>
          {analysis ? (
            <button
              type="button"
              className="btn primary"
              disabled={shareBusy}
              onClick={saveShare}
            >
              {shareBusy ? 'Saving…' : 'Save & get share link'}
            </button>
          ) : null}
        </div>
      ) : null}

      {progress ? <p className="progress">{progress}</p> : null}
      {error ? <p className="meta error">{error}</p> : null}
      {shareErr ? <p className="meta error">{shareErr}</p> : null}

      {shareLink ? (
        <div className="share-box">
          <span className="share-label">Share link</span>
          <code className="share-url">{shareLink}</code>
          <button type="button" className="btn" onClick={copyShare}>
            Copy
          </button>
          <button
            type="button"
            className="btn"
            disabled={!savedShareId}
            onClick={() => savedShareId && navigate(`/review/${savedShareId}`)}
          >
            Open
          </button>
        </div>
      ) : null}

      <footer className="footer">
        {!readOnly ? (
          <button
            type="button"
            className="linkish"
            onClick={() => disposeStockfish()}
          >
            Dispose engine worker
          </button>
        ) : null}
        <span className="hint">
          API: <code>POST /api/analysis</code> · paths <code>/review/…</code>
        </span>
      </footer>
    </div>
  )
}
