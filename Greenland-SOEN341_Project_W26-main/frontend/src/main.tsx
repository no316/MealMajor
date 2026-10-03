/**
 * @file main.tsx
 * @description React application entry point.
 *
 * Mounts the root `<App />` component inside React's StrictMode to
 * highlight potential problems during development (double-invocation
 * of lifecycle methods, deprecated API usage, etc.).
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Mount the React tree onto the #root element defined in index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)