import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-192.png",
        "icons/maskable-512.png"
      ],
      manifest: {
        name: "Météo IA Belgique",
        short_name: "Météo IA",
        description: "Prévisions intelligentes optimisées pour la Belgique (PWA).",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b0b10",
        theme_color: "#7c3aed",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://api.open-meteo.com",
            handler: "NetworkFirst",
            options: {
              cacheName: "open-meteo",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 30 }
            }
          },
          {
            urlPattern: ({ url }) => url.origin === "https://nominatim.openstreetmap.org",
            handler: "NetworkFirst",
            options: {
              cacheName: "nominatim",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 }
            }
          }
        ]
      }
    })
  ]
});
