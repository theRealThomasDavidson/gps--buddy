import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage.tsx'
import { MapPage } from './pages/MapPage.tsx'
import { OptionsPage } from './pages/OptionsPage.tsx'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/options" element={<OptionsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
