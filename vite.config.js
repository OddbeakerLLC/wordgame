import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  base: '/wordmaster/',
  plugins: [
    // Copy HeadTTS worker and language modules to public folder for production
    {
      name: 'copy-headtts-assets',
      buildStart() {
        try {
          // Create headtts directories in public
          mkdirSync('public/headtts/modules', { recursive: true });
          mkdirSync('public/headtts/dictionaries', { recursive: true });

          // Copy all necessary module files
          const modulesToCopy = [
            'worker-tts.mjs',
            'language-en-us.mjs',
            'language.mjs',
            'utils.mjs'
          ];

          for (const module of modulesToCopy) {
            copyFileSync(
              `node_modules/@met4citizen/headtts/modules/${module}`,
              `public/headtts/modules/${module}`
            );
          }

          // Copy dictionary files
          const dictionariesToCopy = ['en-us.txt'];
          for (const dict of dictionariesToCopy) {
            copyFileSync(
              `node_modules/@met4citizen/headtts/dictionaries/${dict}`,
              `public/headtts/dictionaries/${dict}`
            );
          }

          console.log('HeadTTS assets copied to public folder');
        } catch (error) {
          console.warn('Failed to copy HeadTTS assets:', error.message);
        }
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['sounds/**/*', 'icon.svg', 'icon-192.png', 'icon-512.png', 'headtts/**/*'],
      manifest: {
        name: 'Word Master Challenge - Spelling Game for Kids',
        short_name: 'Word Master',
        description: 'An interactive spelling game that helps children master sight words through fun drills and daily quizzes with spaced repetition',
        theme_color: '#8b5cf6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/wordmaster/',
        scope: '/wordmaster/',
        categories: ['education', 'games', 'kids'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,wav,mjs}'],
        // Increase max size to accommodate HeadTTS models
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-static',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache HeadTTS models and voices from Hugging Face
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'headtts-models',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache transformers.js from jsDelivr
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-js',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    host: true,
    port: 3000
  }
});
