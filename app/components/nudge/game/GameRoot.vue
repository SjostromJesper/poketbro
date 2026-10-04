<script setup lang="ts">
import { computed } from 'vue'
import BattleScene from '~/components/nudge/battle/BattleScene.vue'
import OverworldScene from '~/components/nudge/overworld/OverworldScene.vue'
import { useGameStore } from '~/stores/nudge/game'
import { usePlayerStore } from '~/stores/nudge/player'
import EvolutionScene from './EvolutionScene.vue'
import Hud from './Hud.vue'
import MoveReplaceDialog from './MoveReplaceDialog.vue'
import ShopMenu from './ShopMenu.vue'
import StarterSelect from './StarterSelect.vue'

const game = useGameStore()
const player = usePlayerStore()
const overlay = computed(() => game.overlay)
</script>

<template>
  <div class="game-root">
    <OverworldScene>
      <template #overlay>
        <Hud v-if="player.party.length > 0" />
        <StarterSelect v-if="overlay?.kind === 'starter'" @choose="game.chooseStarter" />
        <ShopMenu v-else-if="overlay?.kind === 'shop'" :shop-id="overlay.shopId" @close="game.closeShop" />
        <MoveReplaceDialog v-else-if="overlay?.kind === 'learn'" :uid="overlay.uid" :move="overlay.move" @resolve="game.resolveLearn" />
        <EvolutionScene v-else-if="overlay?.kind === 'evolve'" :uid="overlay.uid" :to="overlay.to" @resolve="game.resolveEvolve" />
      </template>
    </OverworldScene>

    <div v-if="game.screen === 'transition'" class="flash" />
    <div v-if="game.screen === 'battle'" class="battle-layer">
      <BattleScene :bag="player.bag" @item-used="player.removeItem($event)" @finished="game.finishBattle" />
    </div>
  </div>
</template>

<style scoped>
.game-root {
  position: absolute;
  inset: 0;
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
  background: #0f1620;
  background-image: radial-gradient(circle at 50% 0%, #1d2b3d 0%, #0f1620 60%);
}
</style>
