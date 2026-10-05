<script setup lang="ts">
// Plays a cutscene (nudge/game/cutscene.ts) full screen: sprites on a stage, a typewriter text box, small illustrations, name entry and choices.
// One press advances one step (key repeat is ignored); the engine holds all the rules, this component only draws and forwards input.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, triggerRef } from 'vue'
import { gameData } from '~~/nudge/data'
import { CutsceneRunner, type CutsceneHooks, type CutsceneStep, type StageSprite } from '~~/nudge/game/cutscene'
import type { SpriteKey } from '~~/nudge/game/themes/types'
import { useAudioStore } from '~/stores/nudge/audio'
import StageCharacter from './StageCharacter.vue'

const props = withDefaults(defineProps<{
  steps: CutsceneStep[]
  vars?: Record<string, string>
  /** The look of "the player" and "the rival" sprites. */
  playerSprite?: SpriteKey
  rivalSprite?: SpriteKey
  speed?: number
  /** Replaces the default background (a colour or gradient). */
  background?: string
}>(), { vars: () => ({}), playerSprite: 'player', rivalSprite: 'rival', speed: 1, background: '' })
const emit = defineEmits<{ (e: 'done', vars: Record<string, string>): void }>()

const audio = useAudioStore()
const hooks: CutsceneHooks = {
  cry: id => audio.cry(id),
  music: id => audio.music(id),
  jingle: id => void audio.jingle(id),
}
const runner = new CutsceneRunner(props.steps, hooks, { vars: props.vars, speed: props.speed })
const view = shallowRef(runner.state)
const text = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
let raf = 0
let last = 0
let reported = false

function frame(now: number) {
  const dt = Math.min(100, now - (last || now))
  last = now
  runner.update(dt)
  triggerRef(view)
  if (runner.finished && !reported) {
    reported = true
    emit('done', { ...runner.vars })
  }
  raf = requestAnimationFrame(frame)
}

const state = view
const shown = computed(() => state.value.text?.line.slice(0, Math.floor(state.value.text.revealed)) ?? '')
const lineDone = computed(() => !!state.value.text && state.value.text.revealed >= state.value.text.line.length)
const prompt = computed(() => state.value.prompt)

function characterFor(sprite: StageSprite): SpriteKey | null {
  if (sprite.kind === 'character') return sprite.sprite
  if (sprite.kind === 'player') return (runner.vars.playerSprite as SpriteKey | undefined) ?? props.playerSprite
  if (sprite.kind === 'rival') return props.rivalSprite
  return null
}

function pokemonSprite(sprite: StageSprite): string | null {
  return sprite.kind === 'pokemon' ? (gameData.species[sprite.speciesId]?.sprites.front ?? null) : null
}

function spriteStyle(s: (typeof state.value.sprites)[number]) {
  const p = s.progress
  const x = s.at === 'left' ? 20 : s.at === 'right' ? 80 : 50
  let transform = 'translateX(-50%)'
  let opacity = 1
  if (s.leaving === 'shrink') transform += ` scale(${0.15 + 0.85 * p})`
  else if (s.leaving === 'fade') opacity = p
  else if (s.anim === 'slide' && p < 1) {
    const from = s.at === 'right' ? 60 : -60
    transform = `translateX(calc(-50% + ${(1 - p) * from}px))`
    opacity = p
  } else if (s.anim === 'pop' && p < 1) {
    transform += ` scale(${0.3 + 0.7 * p})`
    opacity = p
  }
  return { left: `${x}%`, transform, opacity }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return
  if (event.key === ' ' || event.key === 'Enter' || event.key === 'z' || event.key === 'Z') {
    event.preventDefault()
    runner.press()
  }
}

function onClickStage() {
  runner.press()
}

function submitName() {
  runner.answer(text.value)
  text.value = ''
}

function pick(i: number) {
  runner.answer(i)
}

function suggest(name: string) {
  text.value = name
  inputEl.value?.focus()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  runner.start()
  triggerRef(view)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  cancelAnimationFrame(raf)
})

defineExpose({ runner })
</script>

<template>
  <div class="cutscene" :style="background ? { background } : undefined" @click="onClickStage">
    <div class="stage">
      <div v-for="s in state.sprites" :key="s.id" class="actor" :style="spriteStyle(s)">
        <StageCharacter v-if="characterFor(s.sprite)" :sprite="characterFor(s.sprite)!" />
        <img v-else-if="pokemonSprite(s.sprite)" class="mon" :src="pokemonSprite(s.sprite)!" alt="" draggable="false">
      </div>
    </div>

    <div v-if="state.illustration" class="illustration px-panel" aria-hidden="true">
      <template v-if="state.illustration === 'atb'">
        <div class="ill-label">ATB</div>
        <div class="atb"><i /></div>
      </template>
      <template v-else-if="state.illustration === 'move'">
        <div class="ill-label">Attacker</div>
        <div class="move-btn">Ember</div>
      </template>
      <template v-else-if="state.illustration === 'heart'">
        <div class="heart">♥</div>
      </template>
      <template v-else-if="state.illustration === 'dots'">
        <div class="ill-label">Uppmuntran</div>
        <div class="dots"><i /><i /><i /></div>
      </template>
    </div>

    <div v-if="state.text" class="box" role="dialog">
      <div v-if="state.text.speaker" class="speaker px-title">{{ state.text.speaker }}</div>
      <p class="line">{{ shown }}<span v-if="lineDone" class="more">▼</span></p>
    </div>

    <div v-if="prompt" class="prompt-layer" @click.stop>
      <div class="prompt px-panel">
        <p v-if="prompt.prompt" class="ask">{{ prompt.prompt }}</p>
        <template v-if="prompt.kind === 'input'">
          <input
            ref="inputEl" v-model="text" class="name-field" type="text" :maxlength="prompt.maxLength" autofocus autocomplete="off"
            aria-label="Namn" @keydown.enter.prevent="submitName"
          >
          <div class="suggestions">
            <button v-for="name in prompt.suggestions" :key="name" type="button" class="px-btn small" @click="suggest(name)">{{ name }}</button>
          </div>
          <button type="button" class="px-btn primary" :disabled="!text.trim()" @click="submitName">OK</button>
        </template>
        <template v-else>
          <div class="choices">
            <button v-for="(option, i) in prompt.options" :key="option" type="button" class="px-btn" :class="{ primary: i === 0 }" @click="pick(i)">{{ option }}</button>
          </div>
        </template>
      </div>
    </div>

    <div class="black" :style="{ opacity: state.blackness }" />
  </div>
</template>

<style scoped>
.cutscene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #5a7aa0 0%, #2c3e5a 55%, #141c2c 100%);
  user-select: none;
}

.stage {
  position: absolute;
  inset: 0 0 150px 0;
}

.actor {
  position: absolute;
  bottom: 12px;
}

.mon {
  height: 150px;
  image-rendering: pixelated;
  display: block;
}

.black {
  position: absolute;
  inset: 0;
  background: #000;
  pointer-events: none;
}

.box {
  position: absolute;
  left: 3%;
  right: 3%;
  bottom: 4%;
  min-height: 100px;
  padding: 14px 18px;
  background: #f8ecd0;
  color: #2a1c12;
  border: 4px solid #2a1c12;
  box-shadow: inset 0 0 0 3px #c8b088, 4px 4px 0 rgba(0, 0, 0, 0.4);
  cursor: pointer;
  z-index: 5;
}

.speaker {
  position: absolute;
  top: -16px;
  left: 14px;
  font-size: 10px;
  padding: 5px 8px;
  background: #2a1c12;
  color: #ffd840;
}

.line {
  margin: 0;
  font-size: 20px;
  line-height: 1.45;
  min-height: 58px;
}

.more {
  position: absolute;
  right: 14px;
  bottom: 8px;
  animation: bounce 0.7s steps(2) infinite;
}

@keyframes bounce {
  50% { transform: translateY(3px); }
}

.illustration {
  position: absolute;
  right: 6%;
  top: 8%;
  padding: 14px 18px;
  min-width: 180px;
  text-align: center;
  z-index: 4;
}

.ill-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: #ffd840;
  margin-bottom: 8px;
}

.atb {
  height: 14px;
  background: #2a1c12;
  border: 2px solid #8a6a44;
}

.atb i {
  display: block;
  height: 100%;
  background: #4ad04a;
  animation: fill 2.4s linear infinite;
}

@keyframes fill {
  from { width: 0; }
  to { width: 100%; }
}

.move-btn {
  padding: 8px 14px;
  background: #c8402c;
  border: 3px solid #2a1c12;
  color: #fff4dc;
  animation: blink 0.9s steps(2) infinite;
}

@keyframes blink {
  50% { background: #ffb84a; color: #2a1c12; }
}

.heart {
  font-size: 54px;
  color: #ff5a78;
  animation: beat 0.9s ease-in-out infinite;
}

@keyframes beat {
  50% { transform: scale(1.2); }
}

.dots {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.dots i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffd840;
  border: 2px solid #2a1c12;
}

.prompt-layer {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  z-index: 8;
}

.prompt {
  padding: 18px 22px;
  width: min(420px, 92%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
  text-align: center;
}

.ask {
  margin: 0;
  font-size: 18px;
}

.name-field {
  font: inherit;
  font-size: 22px;
  padding: 8px 10px;
  text-align: center;
  background: #fff4dc;
  color: #2a1c12;
  border: 3px solid #2a1c12;
}

.suggestions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.choices {
  display: flex;
  gap: 10px;
  justify-content: center;
}
</style>
