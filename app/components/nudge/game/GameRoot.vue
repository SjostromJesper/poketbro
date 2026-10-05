<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from '#imports'
import BattleScene from '~/components/nudge/battle/BattleScene.vue'
import OverworldScene from '~/components/nudge/overworld/OverworldScene.vue'
import { useGameStore } from '~/stores/nudge/game'
import { usePlayerStore } from '~/stores/nudge/player'
import BoxScreen from './BoxScreen.vue'
import EvolutionScene from './EvolutionScene.vue'
import GiftSelect from './GiftSelect.vue'
import TravelMenu from './TravelMenu.vue'
import Hud from './Hud.vue'
import GameMenu from '~/components/nudge/menu/GameMenu.vue'
import { useWorldStore } from '~/stores/nudge/world'
import ShopMenu from './ShopMenu.vue'
import StarterSelect from './StarterSelect.vue'
import CutsceneScene from '~/components/nudge/cutscene/CutsceneScene.vue'
import { introSteps, quickIntroSteps } from '~~/nudge/game/text/intro'
import { useSettingsStore } from '~/stores/nudge/settings'
import { PLAYER_LOOKS } from '~~/nudge/game/sprites'

const game = useGameStore()
const player = usePlayerStore()
const world = useWorldStore()
const settings = useSettingsStore()
const overlay = computed(() => game.overlay)
const route = useRoute()
// Dev shortcut: /nudge/play?menu=party|bag|summary opens the menu on that screen (the play page opens the menu itself).
const initialMenu = computed(() => {
  const m = route.query.menu
  return m === 'party' || m === 'bag' || m === 'summary' ? m : 'main'
})
</script>

<template>
  <div class="game-root">
    <OverworldScene>
      <template #overlay>
        <Hud v-if="player.party.length > 0 && !world.menuOpen" />
        <GameMenu v-if="world.menuOpen" :initial-screen="initialMenu" />
        <StarterSelect v-if="overlay?.kind === 'starter'" @choose="game.chooseStarter" />
        <ShopMenu v-else-if="overlay?.kind === 'shop'" :shop-id="overlay.shopId" @close="game.closeShop" />
        <GiftSelect v-else-if="overlay?.kind === 'gift'" :options="overlay.options" @choose="game.chooseGift" />
        <TravelMenu v-else-if="overlay?.kind === 'travel'" @travel="game.travelTo" @close="game.closeOverlay" />
        <BoxScreen v-else-if="overlay?.kind === 'pc'" @close="game.closePc" />
        <EvolutionScene v-else-if="overlay?.kind === 'evolve'" :uid="overlay.uid" :to="overlay.to" @resolve="game.resolveEvolve" />
      </template>
    </OverworldScene>

    <CutsceneScene
      v-if="game.screen === 'intro'" :key="game.introMode" class="intro-layer" :skippable="game.introMode === 'full' && settings.introSeen"
      :steps="game.introMode === 'quick' ? quickIntroSteps({ lookCount: PLAYER_LOOKS.length }) : introSteps({ lookCount: PLAYER_LOOKS.length })"
      @skip="game.skipIntro" @done="game.finishIntro"
    />
    <div v-if="game.screen === 'transition'" class="flash" />
    <div v-if="game.screen === 'battle'" class="battle-layer">
      <BattleScene :bag="player.bag" :sequence="game.sequence" @item-used="player.removeItem($event)" @ended="game.beginPostBattle($event!)" @finished="game.finishBattle" />
    </div>
  </div>
</template>

<style scoped>
.game-root {
  position: absolute;
  inset: 0;
}

.intro-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
}

.flash {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: #000;
  animation: flash 0.9s steps(1) forwards;
}

@keyframes flash {
  0% { background: #fff; }
  12% { background: #000; }
  25% { background: #fff; }
  37% { background: #000; }
  50% { background: #fff; }
  62%, 100% { background: #000; }
}

.battle-layer {
  position: fixed;
  inset: 0;
  z-index: 50;
  overflow: auto;
  padding: 12px;
  background: #2a1f16;
  background-image: radial-gradient(circle at 50% 0%, #4a3626 0%, #2a1f16 60%);
}
</style>
