import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' → rutas relativas, funciona en GitHub Pages en cualquier subruta (usuario.github.io/repo/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Firestore pesa ~550 KB pero ya va en un chunk aparte que se carga bajo
    // demanda (import() en src/api/sync.js); el aviso no aporta nada.
    chunkSizeWarningLimit: 600,
  },
})
