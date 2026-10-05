import { describe, expect, it } from 'vitest'
import { accessOf, cleanDisplayName, formatPlayer, parseTag, validateCredentials } from '../game/account'
import { readFileSync } from 'node:fs'

describe('player ids', () => {
  it('formats Name #1452', () => {
    expect(formatPlayer({ displayName: 'Anna', tag: 1452 })).toBe('Anna #1452')
    expect(formatPlayer({ displayName: 'Bo', tag: 10234 })).toBe('Bo #10234')
  })

  it('reads ids with or without the hash and refuses the rest', () => {
    expect(parseTag('#1452')).toBe(1452)
    expect(parseTag('1452')).toBe(1452)
    expect(parseTag('  # 1452 ')).toBe(1452)
    expect(parseTag('10234')).toBe(10234)
    for (const bad of ['', '#', '999', '145', 'abc', '1452x', '123456', '12.5', '#-1452']) expect(parseTag(bad), bad).toBeNull()
  })

  it('keeps trainer names to ten characters and refuses empty ones', () => {
    expect(cleanDisplayName('  Maja ')).toBe('Maja')
    expect(cleanDisplayName('Elfenbenskusten')).toBe('Elfenbensk')
    expect(cleanDisplayName('   ')).toBeNull()
  })

  it('checks the sign-up form', () => {
    expect(validateCredentials('a@b.se', '123456')).toBeNull()
    expect(validateCredentials('inte-mejl', '123456')).toMatch(/e-post/)
    expect(validateCredentials('a@b.se', '123')).toMatch(/minst 6/)
  })

  it('tells signed-out, anonymous and e-mail accounts apart (only the last one may play)', () => {
    expect(accessOf(null)).toBe('signed-out')
    expect(accessOf({ is_anonymous: true })).toBe('anonymous')
    expect(accessOf({ is_anonymous: false, email: null })).toBe('anonymous')
    expect(accessOf({ is_anonymous: false, email: 'a@b.se' })).toBe('account')
  })
})

describe('the profiles migration', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/0015_nudge_profiles.sql', import.meta.url), 'utf8')

  it('only creates new objects and never touches other tables', () => {
    expect(sql).toContain('create table if not exists public.profiles')
    expect(sql).not.toMatch(/alter table (?!public\.profiles)/i)
    expect(sql).not.toMatch(/drop table/i)
  })

  it('has row level security, no direct writes except the name, and a server-side tag', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke insert, update, delete on public.profiles')
    expect(sql).toContain('grant update (display_name)')
    expect(sql).toContain('tag int not null unique')
    expect(sql).toContain('security definer')
    expect(sql).toContain('10000')
  })
})
