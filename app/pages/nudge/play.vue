<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from '#imports'
import OverworldScene from '~/components/nudge/overworld/OverworldScene.vue'
import NudgeFrame from '~/components/nudge/NudgeFrame.vue'
import { useWorldStore } from '~/stores/nudge/world'
import { getMap } from '~~/nudge/game/maps'
import { newWorldState } from '~~/nudge/game/world'

const route = useRoute()
const world = useWorldStore()

onMounted(() => {
  const state = newWorldState()
  // Dev shortcut while the game is being built: ?map=gruss&x=11&y=14&starter=1
  const mapId = typeof route.query.map === 'string' ? route.query.map : null
  if (mapId) {
    try {
      getMap(mapId)
      state.mapId = mapId
      state.x = Number(route.query.x ?? state.x)
      state.y = Number(route.query.y ?? state.y)
    } catch {
      // unknown map: start in Hemstad
    }
  }
  if (route.query.starter === '1') state.flags.push('starter')
  world.start(state)
  // Dev shortcut to preview the dialog box: ?say=Hej
  if (typeof route.query.say === 'string') world.openDialog([route.query.say, 'Och här är nästa rad.'], 'Professor Almqvist')
})

onBeforeUnmount(() => world.setHooks({}))
</script>

<template>
  <NudgeFrame>
    <OverworldScene />
  </NudgeFrame>
</template>
