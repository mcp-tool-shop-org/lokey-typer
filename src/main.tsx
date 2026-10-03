import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AmbientProvider, App, PreferencesProvider } from '@app'
import { ErrorBoundary } from '@app/components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <PreferencesProvider>
          <AmbientProvider>
            <App />
          </AmbientProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
