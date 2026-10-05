<script setup lang="ts">
// The computer in a Pokémon Center: the Pokémon box as before, and (new) the network menu.
import { ref } from 'vue'
import BoxScreen from './BoxScreen.vue'
import NetworkScreen from './NetworkScreen.vue'
import { useAccountStore } from '~/stores/nudge/account'
import { useNetworkStore } from '~/stores/nudge/network'

const emit = defineEmits<{ (e: 'close'): void }>()
const view = ref<'menu' | 'box' | 'network'>('menu')
const account = useAccountStore()
const network = useNetworkStore()
</script>

<template>
  <BoxScreen v-if="view === 'box'" @close="view = 'menu'" />
  <div v-else class="modal">
    <div class="px-panel box">
      <template v-if="view === 'menu'">
        <h2 class="px-title">Datorn</h2>
        <p v-if="account.label" class="id">Ditt spelar-ID: {{ account.label }}</p>
        <div class="menu">
          <button type="button" class="px-btn" @click="view = 'box'">Pokémon-box</button>
          <button type="button" class="px-btn" @click="view = 'network'">Nätverk<span v-if="network.unseen" class="dot">{{ network.unseen }}</span></button>
          <button type="button" class="px-btn" @click="emit('close')">Logga ut</button>
        </div>
      </template>
      <NetworkScreen v-else @back="view = 'menu'" />
    </div>
  </div>
</template>

<style scoped>
.modal { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0, 0, 0, 0.7); z-index: 30; }
.box { width: min(720px, 96%); max-height: 94%; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow: auto; }
h2 { margin: 0; font-size: 12px; }
.id { margin: 0; font-size: 16px; color: #ffd840; }
.menu { display: flex; flex-direction: column; gap: 8px; max-width: 280px; }
.dot { margin-left: 6px; padding: 0 6px; background: #c8402c; color: #fff4dc; border-radius: 9px; font-size: 12px; }
</style>
