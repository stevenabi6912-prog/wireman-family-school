// Dev-only entry for gamelab.html — the Game Lab with no router and no auth.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import GameLab from './pages/GameLab.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameLab />
  </StrictMode>,
)
