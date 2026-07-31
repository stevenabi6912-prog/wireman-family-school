import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this app from https://<user>.github.io/<repo>/, so the
// base path must match the repo name in production. Set VITE_BASE_PATH in the
// deploy workflow once the repo is created; defaults to '/' for local dev.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
