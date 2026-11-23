import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Porta fixa: o CORS do back só libera http://localhost:5173.
  server: { port: 5173, strictPort: true },
})