import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // jsPDF lazy-loads these via dynamic import() only for its SVG/HTML
      // rendering plugins, which this app never uses (PDFs are generated
      // from a pre-rendered canvas + addImage). Externalizing them keeps
      // Rollup from needing them installed at build time.
      external: ['canvg', 'dompurify'],
    },
  },
})
