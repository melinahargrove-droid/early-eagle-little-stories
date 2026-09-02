import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/early-eagle-little-stories/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'Little Stories',
        short_name: 'Little Stories',
        description: 'Classroom memories made into beautiful printable books.',
        theme_color: '#f7f1e7',
        background_color: '#f7f1e7',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        categories: ['education', 'photo'],
        icons: []
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
})
