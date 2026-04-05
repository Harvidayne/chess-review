import { Routes, Route } from 'react-router-dom'
import { AnalyzerPage } from './pages/AnalyzerPage'
import { ReviewPage } from './pages/ReviewPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AnalyzerPage />} />
      <Route path="/review/:shareId" element={<ReviewPage />} />
    </Routes>
  )
}
