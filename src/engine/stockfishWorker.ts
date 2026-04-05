/**
 * UCI client around stockfish.js worker (public/stockfish/stockfish.wasm.js).
 * Position cache: same logical position (FEN fields 0–3) reuses search instantly.
 */

export type SearchResult = {
  bestmove: string
  scoreCp: number | null
  scoreMate: number | null
}

/** Board + side + castling + EP — ignores halfmove/fullmove clocks. */
export function fenPositionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ')
}

function parseInfoScore(line: string): { cp?: number; mate?: number } | null {
  const mateM = line.match(/\bscore mate (-?\d+)/)
  if (mateM) return { mate: parseInt(mateM[1], 10) }
  const cpM = line.match(/\bscore cp (-?\d+)/)
  if (cpM) return { cp: parseInt(cpM[1], 10) }
  return null
}

function stmFromFen(fen: string): 'w' | 'b' {
  const parts = fen.split(/\s+/)
  return parts[1] === 'b' ? 'b' : 'w'
}

/** Stockfish score is for side to move; convert to White-positive centipawns (mate as large proxy). */
export function toWhitePov(fen: string, r: SearchResult): number {
  const stm = stmFromFen(fen)
  if (r.scoreMate != null) {
    const m = r.scoreMate
    const v = m > 0 ? 10000 - Math.abs(m) : -10000 - Math.abs(m)
    return stm === 'w' ? v : -v
  }
  const cp = r.scoreCp ?? 0
  return stm === 'w' ? cp : -cp
}

export class StockfishEngine {
  private worker: Worker
  private queue: string[] = []
  private waiters: Array<(line: string) => void> = []
  private readonly resultCache = new Map<string, SearchResult>()

  constructor(workerUrl = '/stockfish/stockfish.wasm.js') {
    this.worker = new Worker(workerUrl)
    this.worker.onmessage = (e: MessageEvent<string>) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data)
      const w = this.waiters.shift()
      if (w) w(line)
      else this.queue.push(line)
    }
  }

  dispose(): void {
    try {
      this.worker.postMessage('quit')
    } catch {
      /* ignore */
    }
    this.worker.terminate()
    this.resultCache.clear()
  }

  clearCache(): void {
    this.resultCache.clear()
  }

  cacheSize(): number {
    return this.resultCache.size
  }

  private readLine(): Promise<string> {
    if (this.queue.length) {
      return Promise.resolve(this.queue.shift()!)
    }
    return new Promise((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('Stockfish read timeout')), 180_000)
      this.waiters.push((line) => {
        clearTimeout(t)
        resolve(line)
      })
    })
  }

  async init(): Promise<void> {
    this.worker.postMessage('uci')
    for (;;) {
      const line = await this.readLine()
      if (line === 'uciok') break
    }
    this.worker.postMessage('isready')
    for (;;) {
      const line = await this.readLine()
      if (line === 'readyok') break
    }
  }

  /**
   * Raw search (no cache). Prefer searchPosition for analysis loops.
   */
  async goDepth(fen: string, depth: number): Promise<SearchResult> {
    this.worker.postMessage(`position fen ${fen}`)
    this.worker.postMessage(`go depth ${depth}`)

    let lastScore: { cp?: number; mate?: number } | null = null
    let bestmove = ''

    for (;;) {
      const line = await this.readLine()
      if (line.startsWith('info')) {
        const s = parseInfoScore(line)
        if (s) lastScore = s
      } else if (line.startsWith('bestmove')) {
        const m = line.match(/bestmove (\S+)/)
        bestmove = m?.[1] ?? ''
        break
      }
    }

    return {
      bestmove,
      scoreCp: lastScore?.cp ?? null,
      scoreMate: lastScore?.mate ?? null,
    }
  }

  /**
   * Cached search: same position key skips the worker (instant replay).
   */
  async searchPosition(fen: string, depth: number): Promise<SearchResult> {
    const key = `${fenPositionKey(fen)}|d${depth}`
    const hit = this.resultCache.get(key)
    if (hit) {
      return {
        bestmove: hit.bestmove,
        scoreCp: hit.scoreCp,
        scoreMate: hit.scoreMate,
      }
    }
    const r = await this.goDepth(fen, depth)
    this.resultCache.set(key, {
      bestmove: r.bestmove,
      scoreCp: r.scoreCp,
      scoreMate: r.scoreMate,
    })
    return r
  }
}

let singleton: StockfishEngine | null = null

export async function getStockfish(): Promise<StockfishEngine> {
  if (!singleton) {
    singleton = new StockfishEngine()
    await singleton.init()
  }
  return singleton
}

export function disposeStockfish(): void {
  singleton?.dispose()
  singleton = null
}
