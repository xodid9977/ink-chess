import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// host: true → 같은 Wi-Fi의 태블릿·폰에서 PC 주소로 접속 가능
// base './' → 어떤 주소(GitHub Pages 하위 경로 등)에 올려도 동작
export default defineConfig({
  base: './',
  server: { host: true, port: 5179 },
  preview: { host: true, port: 5179 },
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-180.png'],
      manifest: {
        name: '잉크 체스',
        short_name: '잉크 체스',
        description: '마법 일기장 위에서 펜과 잉크로 두는 체스',
        lang: 'ko',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#f1eee7',
        theme_color: '#f1eee7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 글꼴·그림까지 전부 저장 → 한 번 열면 인터넷 없이도 실행
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
});
