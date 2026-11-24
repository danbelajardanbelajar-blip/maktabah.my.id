import {RowaCardsProvider} from './components/RowaCards';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {startVisitTracking} from './lib/visit-tracker.js'
import {installAdminRequestIdentity} from './lib/admin-request-identity'

installAdminRequestIdentity();
startVisitTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RowaCardsProvider><App /></RowaCardsProvider>
  </StrictMode>,
)
