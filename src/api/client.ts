import type { GameAnalysisPayload } from '../engine/analysisTypes'

function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? ''
}

export async function saveAnalysis(
  pgn: string,
  analysis: GameAnalysisPayload,
): Promise<{ share_id: string }> {
  const url = `${apiBase()}/api/analysis`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pgn, analysis }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(t || r.statusText)
  }
  return r.json()
}

export async function loadAnalysis(shareId: string): Promise<{
  pgn: string
  analysis: GameAnalysisPayload
}> {
  const url = `${apiBase()}/api/analysis/${encodeURIComponent(shareId)}`
  const r = await fetch(url)
  if (!r.ok) {
    let msg =
      r.status === 404
        ? 'This review was not found (check the link, or the server may have been redeployed without persistent storage).'
        : 'Could not load this review.'
    try {
      const j = (await r.json()) as { error?: string }
      if (typeof j?.error === 'string') msg = j.error
    } catch {
      /* non-JSON body */
    }
    throw new Error(msg)
  }
  return r.json()
}
