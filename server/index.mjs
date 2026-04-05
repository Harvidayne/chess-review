import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

/**
 * Persist reviews here. On Render, set PERSISTENCE_PATH to a mounted disk path
 * so share links survive deploys/restarts.
 */
const DATA_ROOT = process.env.PERSISTENCE_PATH || path.join(__dirname, 'data')
const DATA = path.join(DATA_ROOT, 'store.json')

const app = express()
app.use(express.json({ limit: '4mb' }))

const isProd = process.env.NODE_ENV === 'production'
if (!isProd) {
  app.use(cors({ origin: true }))
}

let store = {}
function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(DATA, 'utf8'))
  } catch {
    store = {}
  }
}
function saveStore() {
  fs.mkdirSync(path.dirname(DATA), { recursive: true })
  fs.writeFileSync(DATA, JSON.stringify(store, null, 2))
}
loadStore()

function postAnalysis(req, res) {
  const { pgn, analysis } = req.body || {}
  if (typeof pgn !== 'string' || !analysis || typeof analysis !== 'object') {
    return res.status(400).json({ error: 'Expected { pgn, analysis }' })
  }
  if (!Array.isArray(analysis.moves) || !Array.isArray(analysis.plyEvalWhite)) {
    return res.status(400).json({ error: 'analysis must include moves[] and plyEvalWhite[]' })
  }
  const share_id = nanoid(10)
  store[share_id] = {
    pgn,
    analysis,
    created: new Date().toISOString(),
  }
  saveStore()
  res.json({ share_id })
}

app.post('/api/analysis', postAnalysis)
app.post('/analysis', postAnalysis)

app.get('/api/analysis/:id', (req, res) => {
  const row = store[req.params.id]
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({ pgn: row.pgn, analysis: row.analysis })
})

if (isProd) {
  app.use(express.static(DIST))
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(404).end()
      return
    }
    res.sendFile(path.join(DIST, 'index.html'))
  })
}

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  console.log(`Server ${PORT} production=${isProd} data=${DATA}`)
})
