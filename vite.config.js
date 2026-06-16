import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/Subsurface.ai/' : '/',
  plugins: [react(), tailwindcss()],
})
