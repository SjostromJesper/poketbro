# The gladiator game (shelved)

"Arenan" (gladiator school, arena, duels, shop, adventure parties) was the first game in this project. It is put aside here so that **Poketbro** is the only game the site shows.
Nothing was deleted: the pages, composables, components, server routes, utilities and shared game code are all here, and its database tables and migrations (`supabase/migrations/0001`-`0013`) are untouched.

To bring it back, move the folders back to where they came from:

```bash
git mv archive/gladiator/app/app.vue app/app.vue            # replaces the small Poketbro-only app.vue (keep its <NuxtPage v-if="isNudge"> idea if both should live side by side)
git mv archive/gladiator/app/pages/*.vue app/pages/
git mv archive/gladiator/app/composables app/composables
git mv archive/gladiator/app/components/*.vue app/components/
git mv archive/gladiator/server/api/* server/api/
git mv archive/gladiator/server/utils server/utils
git mv archive/gladiator/shared shared
```

Also in `nuxt.config.ts`: turn the Supabase redirect back on (`redirectOptions: { login: '/login', callback: '/', exclude: ['/registrera', '/nudge', '/nudge/*'] }`) and remove the `'/': { redirect: '/nudge' }` route rule.
Poketbro keeps using `server/api/auth/register.post.ts` (shared with the old sign-up) and `server/api/nudge/`.
