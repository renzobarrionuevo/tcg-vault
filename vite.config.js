import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' → rutas relativas, funciona en GitHub Pages en cualquier subruta (usuario.github.io/repo/)
export default defineConfig({
  base: './',
  plugins: [react()],
})
