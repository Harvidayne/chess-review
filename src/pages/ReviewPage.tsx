import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadAnalysis } from '../api/client'
import type { GameAnalysisPayload } from '../engine/analysisTypes'
import { AnalyzerPage } from './AnalyzerPage'
import '../App.css'

export function ReviewPage() {
  const { shareId } = useParams<{ shareId: string }>()
  const [pgn, setPgn] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<GameAnalysisPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!shareId) {
      setErr('Missing review id')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await loadAnalysis(shareId)
        if (cancelled) return
        setPgn(data.pgn)
        setAnalysis(data.analysis)
        setErr(null)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Load failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [shareId])

  if (err) {
    return (
      <div className="app">
        <p className="meta error banner-error">{err}</p>
        <Link to="/" className="link-home">
          ← Back home
        </Link>
      </div>
    )
  }

  if (!pgn || !analysis) {
    return (
      <div className="app">
        <p className="progress">Loading review…</p>
      </div>
    )
  }

  return (
    <AnalyzerPage
      key={shareId}
      initialPgn={pgn}
      initialAnalysis={analysis}
      readOnly
    />
  )
}
