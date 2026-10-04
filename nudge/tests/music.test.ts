import { describe, expect, it } from 'vitest'
import { MUSIC } from '../game/audio-manifest'
import { MAPS } from '../game/maps'
import { battleMusic, mapMusic } from '../game/music'
import { TRAINERS } from '../game/trainers'

describe('music assignments', () => {
  it('every map has a track that exists in the manifest', () => {
    for (const map of Object.values(MAPS)) {
      expect(map.music, `map ${map.id}`).toBeDefined()
      expect(Object.keys(MUSIC)).toContain(map.music)
      expect(mapMusic(map.id)).toBe(map.music)
    }
  })

  it('maps the places from the plan to different moods', () => {
    expect(mapMusic('hemstad')).not.toBe(mapMusic('gruss'))
    expect(mapMusic('route1')).not.toBe(mapMusic('skogen'))
    expect(new Set(['hemstad', 'route1', 'skogen', 'gruss_center', 'gruss_gym'].map(mapMusic)).size).toBe(5)
    expect(mapMusic('does-not-exist')).toBeNull()
  })

  it('picks battle music by kind: wild, trainer, gym leader', () => {
    expect(battleMusic('wild')).toBe('battleWild')
    expect(battleMusic('trainer', TRAINERS['gym-granit'] ?? Object.values(TRAINERS).find(t => t.gym))).toBe('battleGym')
    const ordinary = Object.values(TRAINERS).find(t => !t.gym)!
    expect(battleMusic('trainer', ordinary)).toBe('battleTrainer')
    expect(battleMusic('trainer')).toBe('battleTrainer')
  })
})
