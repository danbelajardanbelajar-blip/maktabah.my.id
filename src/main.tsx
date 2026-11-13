import {RowaCardsProvider} from './components/RowaCards';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RowaCardsProvider><App /></RowaCardsProvider>
  </StrictMode>,
)
