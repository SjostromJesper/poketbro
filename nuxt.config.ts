// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt'],
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/',
      // The Nudge prototype is a separate, local-only game: no account needed.
      exclude: ['/registrera', '/nudge', '/nudge/*'],
    },
  },
  routeRules: {
    // Nudge is a pure client-side SPA (canvas + localStorage), no SSR needed.
    '/nudge': { ssr: false },
    '/nudge/**': { ssr: false },
  },
})
