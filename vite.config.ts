import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Site projet GitHub Pages servi sous /fuck-medias/
export default defineConfig({
  base: '/fuck-medias/',
  plugins: [react()],
})
