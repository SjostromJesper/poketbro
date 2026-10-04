<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameData } from '~~/nudge/data'
import { itemInfo, sellPrice, SHOP_BADGE_REQUIREMENT, SHOPS } from '~~/nudge/game/items'
import { usePlayerStore } from '~/stores/nudge/player'

const props = defineProps<{ shopId: string }>()
defineEmits<{ (e: 'close'): void }>()

const player = usePlayerStore()
const tab = ref<'buy' | 'sell'>('buy')
const message = ref('')

const stock = computed(() => (SHOPS[props.shopId] ?? [])
  .filter(id => player.badges.length >= (SHOP_BADGE_REQUIREMENT[id] ?? 0))
  .map(id => itemInfo(gameData, id)))
const sellable = computed(() => Object.entries(player.bag).filter(([, n]) => n > 0).map(([id, n]) => ({ info: itemInfo(gameData, id), n })))

function say(text: string) {
  message.value = text
}

function buy(id: string) {
  const info = itemInfo(gameData, id)
  if (!player.spend(info.price)) return say('Du har inte tillräckligt med pengar.')
  player.addItem(id)
  say(`Du köpte ${info.name}.`)
}

function sell(id: string) {
  if (!player.removeItem(id)) return
  const price = sellPrice(gameData, id)
  player.money += price
  say(`Du sålde ${itemInfo(gameData, id).name} för ${price} kr.`)
}
</script>

<template>
  <div class="modal">
    <div class="px-panel box">
      <div class="head">
        <h2 class="px-title">Pokémart</h2>
        <span class="money">{{ player.money }} kr</span>
      </div>
      <div class="tabs">
        <button type="button" class="px-btn" :class="{ primary: tab === 'buy' }" @click="tab = 'buy'">Köp</button>
        <button type="button" class="px-btn" :class="{ primary: tab === 'sell' }" @click="tab = 'sell'">Sälj</button>
      </div>
      <ul v-if="tab === 'buy'" class="list">
        <li v-for="info in stock" :key="info.id">
          <span class="name">{{ info.name }} <small>(du har {{ player.count(info.id) }})</small></span>
          <span class="desc">{{ info.description }}</span>
          <span class="price">{{ info.price }} kr</span>
          <button type="button" class="px-btn" :disabled="player.money < info.price" @click="buy(info.id)">Köp</button>
        </li>
      </ul>
      <ul v-else class="list">
        <li v-for="entry in sellable" :key="entry.info.id">
          <span class="name">{{ entry.info.name }} x{{ entry.n }}</span>
          <span class="desc">{{ entry.info.description }}</span>
          <span class="price">{{ sellPrice(gameData, entry.info.id) }} kr</span>
          <button type="button" class="px-btn" @click="sell(entry.info.id)">Sälj</button>
        </li>
        <li v-if="sellable.length === 0" class="empty">Du har inget att sälja.</li>
      </ul>
      <p class="message">{{ message }}</p>
      <button type="button" class="px-btn close" @click="$emit('close')">Lämna butiken</button>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 30;
}

.box {
  padding: 14px;
  width: min(720px, 96%);
  max-height: 94%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

h2 {
  font-size: 12px;
  margin: 0;
}

.money {
  color: #ffd840;
  font-size: 18px;
}

.tabs {
  display: flex;
  gap: 8px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

li {
  display: grid;
  grid-template-columns: 180px 1fr 70px 70px;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: #1f2d44;
  border: 2px solid #0a0f16;
}

.name small {
  color: #9fb2cc;
}

.desc {
  font-size: 14px;
  color: #b8c6dc;
}

.price {
  color: #ffd840;
  text-align: right;
}

.empty {
  display: block;
  color: #9fb2cc;
}

.message {
  min-height: 22px;
  margin: 0;
  color: #8ef08e;
}

@media (max-width: 640px) {
  li { grid-template-columns: 1fr 60px 60px; }
  .desc { display: none; }
}
</style>
