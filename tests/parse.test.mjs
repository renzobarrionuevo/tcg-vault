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

test('número de carta Pokémon: 125/182', () => {
  assert.deepEqual(parseInput('125/182'), { type: 'pknum', num: 125, total: 182 })
  assert.deepEqual(parseInput('81 / 198'), { type: 'pknum', num: 81, total: 198 })
})

test('set + número: PAR 125, paradox 125, sv4-123 (también sirve como id de pokemontcg.io)', () => {
  assert.deepEqual(parseInput('PAR 125'), { type: 'setnum', set: 'par', num: 125, total: null, id: 'par-125' })
  assert.deepEqual(parseInput('par-125'), { type: 'setnum', set: 'par', num: 125, total: null, id: 'par-125' })
  assert.deepEqual(parseInput('paradox 125/182'), { type: 'setnum', set: 'paradox', num: 125, total: 182, id: 'paradox-125' })
  assert.deepEqual(parseInput('sv4-123'), { type: 'setnum', set: 'sv4', num: 123, total: null, id: 'sv4-123' })
  assert.deepEqual(parseInput('base1-4'), { type: 'setnum', set: 'base1', num: 4, total: null, id: 'base1-4' })
  // en One Piece "st13 3" se reinterpreta como ST13-003 (lo hace search.js)
  assert.deepEqual(parseInput('st13 3'), { type: 'setnum', set: 'st13', num: 3, total: null, id: 'st13-3' })
})

test('solo un número: todas las cartas con ese número', () => {
  assert.deepEqual(parseInput('125'), { type: 'number', num: 125 })
  assert.deepEqual(parseInput('7'), { type: 'number', num: 7 })
  assert.deepEqual(parseInput('543603').type, 'product', '4+ dígitos sigue siendo productId')
})

test('id de pokemontcg.io con letras en el número', () => {
  assert.deepEqual(parseInput('swsh12pt5gg-GG44'), { type: 'pkcode', id: 'swsh12pt5gg-GG44' })
})

test('todo lo demás es búsqueda por nombre', () => {
  assert.deepEqual(parseInput('charizard'), { type: 'name', q: 'charizard' })
  assert.deepEqual(parseInput('Monkey D. Luffy'), { type: 'name', q: 'Monkey D. Luffy' })
  assert.deepEqual(parseInput('  '), { type: 'empty' })
})
