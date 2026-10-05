<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from '#imports'
import { gameData } from '~~/nudge/data'
import { BALANCE } from '~~/nudge/engine/balance'
import { createPokemon } from '~~/nudge/engine/pokemon'
import { createRandomRng } from '~~/nudge/engine/rng'
import { getMap } from '~~/nudge/game/maps'
import { newWorldState } from '~~/nudge/game/world'
import GameRoot from '~/components/nudge/game/GameRoot.vue'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
import { useBattleStore } from '~/stores/nudge/battle'
import { useGameStore } from '~/stores/nudge/game'
import { usePlayerStore } from '~/stores/nudge/player'
import { isSlot } from '~~/nudge/game/saveSlots'
import { useSavesStore } from '~/stores/nudge/saves'
import { useSettingsStore } from '~/stores/nudge/settings'
import { useWorldStore } from '~/stores/nudge/world'

const route = useRoute()
const game = useGameStore()
const player = usePlayerStore()
const world = useWorldStore()
const settings = useSettingsStore()
const battle = useBattleStore()
const saves = useSavesStore()
const supabase = useSupabaseClient()

/** Saves when the page is hidden or closed (the cloud upload is best effort, the browser copy is what counts). */
function onHide() {
  if (document.visibilityState === 'hidden') {
    game.save(true)
    void saves.flush()
  }
}

function onPageHide() {
  game.save(true)
  void saves.flush()
}

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onHide)
  window.removeEventListener('pagehide', onPageHide)
})

onMounted(() => {
  settings.load()
  saves.init()
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onPageHide)
  void saves.connect(supabase)
  const q = route.query
  const slotParam = Number(q.slot)
  if (isSlot(slotParam)) saves.setActive(slotParam)
  const state = newWorldState()
  // Dev shortcuts while the game is being built, e.g.
  //   /nudge/play?map=gruss&x=11&y=13&starter=1&party=charmander:12,pidgey:8&balls=10&money=3000&badges=1&say=Hej&debug=1
  const devKeys = ['map', 'starter', 'party', 'open', 'encounter', 'menu', 'say', 'balls', 'money', 'badges']
  const dev = devKeys.some(k => k in q)
  const mapId = typeof q.map === 'string' ? q.map : null
  if (mapId) {
    try {
      getMap(mapId)
      state.mapId = mapId
      state.x = Number(q.x ?? state.x)
      state.y = Number(q.y ?? state.y)
    } catch {
      // unknown map: start in Hemstad
    }
  }
  if (q.starter === '1') state.flags.push('starter')
  // Continue a saved game unless a new one was asked for (or a dev shortcut is used).
  game.setEphemeral(dev)
  const wantsContinue = q.continue === '1' || (!dev && q.new !== '1' && game.hasSave())
  if (wantsContinue && game.loadSave()) {
    battle.debug = q.debug === '1' || battle.debug
    return
  }
  game.newGame(state)
  battle.debug = q.debug === '1'
  // A new game starts with the intro (dev shortcuts skip it).
  if (!dev) game.beginIntro()
  if (typeof q.party === 'string') {
    for (const part of q.party.split(',')) {
      const [name, level] = part.split(':')
      const species = Object.values(gameData.species).find(s => s.name === name.toLowerCase())
      if (species) {
        player.addPokemon(createPokemon({
          data: gameData, balance: BALANCE, rng: createRandomRng(), speciesId: species.id, level: Number(level) || 5,
          trust: BALANCE.TRUST_START_STARTER, originalTrainer: player.name,
        }))
      }
    }
    if (!state.flags.includes('starter')) world.world?.setFlag('starter')
  }
  if (q.balls) player.addItem('poke-ball', Number(q.balls))
  if (q.money) player.money = Number(q.money)
  if (q.badges) for (let i = 0; i < Number(q.badges); i++) player.badges.push(`dev-${i}`)
  if (typeof q.menu === 'string') world.openMenu()
  if (q.open === 'starter') game.overlay = { kind: 'starter' }
  if (q.open === 'shop') game.overlay = { kind: 'shop', shopId: 'gruss_mart' }
  if (typeof q.encounter === 'string') {
    const [species, level] = q.encounter.split(':').map(Number)
    game.startWildBattle({ speciesId: species, level: level || 5 })
  }
  if (typeof q.say === 'string') world.openDialog([q.say, 'Och här är nästa rad.'], 'Professor Almqvist')
})
</script>

<template>
  <NudgeFrame>
    <GameRoot />
  </NudgeFrame>
</template>
