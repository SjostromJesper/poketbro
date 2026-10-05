<script setup lang="ts">
interface LogEntry {
  text: string
  actorName?: string
  type: string
  isCrit?: boolean
  isBlocked?: boolean
}

const props = defineProps<{
  log: (string | LogEntry)[]
  viewerName?: string | null
}>()

function isStructured(line: string | LogEntry): line is LogEntry {
  return typeof line === 'object' && line !== null
}

function lineText(line: string | LogEntry): string {
  return isStructured(line) ? line.text : line
}

function lineClasses(line: string | LogEntry): string[] {
  if (!isStructured(line)) return []
  const classes = [`type-${line.type}`]
  if ((line.type === 'hit' || line.type === 'miss') && line.actorName && props.viewerName) {
    classes.push(line.actorName === props.viewerName ? 'mine' : 'theirs')
  }
  if (line.isCrit) classes.push('crit')
  if (line.isBlocked) classes.push('blocked')
  return classes
}

interface RoundGroup {
  header: string | null
  lines: (string | LogEntry)[]
}

// Group the flat log into one card per round, like a real Lanista battle report -
// makes long fights scannable instead of one continuous wall of text.
const groups = computed<RoundGroup[]>(() => {
  const result: RoundGroup[] = []
  let current: RoundGroup = { header: null, lines: [] }
  for (const line of props.log) {
    if (isStructured(line) && line.type === 'round') {
      if (current.header !== null || current.lines.length > 0) result.push(current)
      current = { header: line.text.replace(/^--\s*|\s*--$/g, ''), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.header !== null || current.lines.length > 0) result.push(current)
  return result
})
</script>

<template>
  <div class="battle-log">
    <template v-for="(group, gi) in groups" :key="gi">
      <p v-if="group.header === null" class="intro-line">{{ lineText(group.lines[0]) }}</p>
      <div v-else class="round-card">
        <div class="round-header">{{ group.header }}</div>
        <ul class="round-lines">
          <li v-for="(line, i) in group.lines" :key="i" :class="lineClasses(line)">{{ lineText(line) }}</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
.battle-log {
  padding: 0.75rem;
  margin: 0.5rem 0 0;
  background: var(--bg);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  max-height: min(420px, 55vh);
  overflow-y: auto;
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  /* Make the internal scroll obvious on short screens - a thin OS-default
     scrollbar is easy to miss, which reads as "the text just disappears". */
  scrollbar-width: thin;
  scrollbar-color: var(--border) var(--bg);
}

.battle-log::-webkit-scrollbar {
  width: 8px;
}

.battle-log::-webkit-scrollbar-track {
  background: var(--bg);
}

.battle-log::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.battle-log::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}

.intro-line {
  margin: 0;
  color: var(--text-muted);
}

.round-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  overflow: hidden;
  /* Without this, a flex column child shrinks below its own content height once
     the whole log exceeds max-height, instead of the log scrolling - combined
     with overflow:hidden above, that clipped each round's text mid-line rather
     than showing a scrollbar. */
  flex-shrink: 0;
}

.round-header {
  background: var(--surface-alt);
  color: var(--accent-strong);
  font-weight: bold;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--border-soft);
}

.round-lines {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.type-info {
  color: var(--text-muted);
}

.type-miss {
  opacity: 0.7;
}

/* Matches Lanista's own convention: your actions in green, the opponent's in red. */
.type-hit.mine {
  color: var(--green);
}

.type-hit.theirs {
  color: var(--orange);
}

.type-skill,
.type-heal {
  color: var(--purple);
  font-style: italic;
}

.type-skill::before,
.type-heal::before {
  content: '✦ ';
}

.type-giveup,
.type-exhaustion,
.type-timeout {
  color: var(--text-muted);
  font-style: italic;
}

.crit {
  font-weight: bold;
}

.crit::before {
  content: '★ ';
  color: var(--accent);
}

.crit.mine {
  color: var(--green-light);
}

.crit.theirs {
  color: var(--orange-light);
}

.blocked {
  border-left: 3px solid var(--teal-accent);
  padding-left: 0.5rem;
  margin-left: -0.5rem;
}
</style>
