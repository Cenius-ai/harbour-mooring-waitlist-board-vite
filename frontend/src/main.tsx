import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted type - bundled from the package manager, never a remote font CDN.
// Latin subsets only: the board is an English-language staff tool.
import '@fontsource/rajdhani/latin-400.css'
import '@fontsource/rajdhani/latin-600.css'
import '@fontsource/rajdhani/latin-700.css'
import '@fontsource/chakra-petch/latin-400.css'
import '@fontsource/chakra-petch/latin-500.css'
import '@fontsource/chakra-petch/latin-700.css'

import App from './App'
import './styles/tokens.css'
import './styles/app.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('The application root element is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
