import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInput } from '../src/lib/parse.js'

test('URL de TCGPlayer → productId', () => {
  assert.deepEqual(
    parseInput('https://www.tcgplayer.com/product/543603/one-piece-card-game-ultra-deck-the-three-brothers-sabo-001'),
    { type: 'product', productId: 543603 }
  )
  assert.deepEqual(parseInput('tcgplayer.com/product/12345?Language=English'), { type: 'product', productId: 12345 })
})

test('productId numérico directo', () => {
  assert.deepEqual(parseInput('543603'), { type: 'product', productId: 543603 })
})

test('códigos One Piece se normalizan', () => {
  assert.deepEqual(parseInput('OP01-001'), { type: 'opcode', code: 'OP01-001' })
  assert.deepEqual(parseInput('op1-1'), { type: 'opcode', code: 'OP01-001' })
  assert.deepEqual(parseInput('st13-3'), { type: 'opcode', code: 'ST13-003' })
  assert.deepEqual(parseInput('EB01-006'), { type: 'opcode', code: 'EB01-006' })
  assert.deepEqual(parseInput('P-001'), { type: 'opcode', code: 'P-001' })
  assert.deepEqual(parseInput('p-1'), { type: 'opcode', code: 'P-001' })
})

test('códigos Pokémon (id de pokemontcg.io)', () => {
  assert.deepEqual(parseInput('sv4-123'), { type: 'pkcode', id: 'sv4-123' })
  assert.deepEqual(parseInput('SV4-123'), { type: 'pkcode', id: 'sv4-123' })
  assert.deepEqual(parseInput('base1-4'), { type: 'pkcode', id: 'base1-4' })
  assert.deepEqual(parseInput('swsh12pt5gg-GG44'), { type: 'pkcode', id: 'swsh12pt5gg-GG44' })
})

test('todo lo demás es búsqueda por nombre', () => {
  assert.deepEqual(parseInput('charizard'), { type: 'name', q: 'charizard' })
  assert.deepEqual(parseInput('Monkey D. Luffy'), { type: 'name', q: 'Monkey D. Luffy' })
  assert.deepEqual(parseInput('  '), { type: 'empty' })
})
