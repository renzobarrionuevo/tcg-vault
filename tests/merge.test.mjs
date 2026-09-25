import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeCollections, mergeDeleted, pruneDeleted, tombstones, TOMBSTONE_DAYS } from '../src/lib/storage.js'

const a = { uid: 'a', name: 'Sabo', source: 'csv' }
const b = { uid: 'b', name: 'Ace', source: 'csv' }
const c = { uid: 'c', name: 'Pikachu', source: 'ptcg' }

test('combinar agrega solo lo nuevo', () => {
  const merged = mergeCollections([a, b], [b, c])
  assert.equal(merged.length, 3)
  assert.deepEqual(
    merged.map((x) => x.uid).sort(),
    ['a', 'b', 'c']
  )
})

test('importar dos veces el mismo respaldo no duplica', () => {
  const once = mergeCollections([a], [b, c])
  const twice = mergeCollections(once, [b, c])
  assert.equal(twice.length, 3)
})

test('items sin uid reciben uno nuevo', () => {
  const merged = mergeCollections([], [{ name: 'Zoro', source: 'csv' }])
  assert.equal(merged.length, 1)
  assert.ok(merged[0].uid)
})

test('lo borrado no vuelve desde un respaldo ni desde otro dispositivo', () => {
  const deleted = tombstones(['b'])
  // el otro lado todavía la tiene
  assert.deepEqual(mergeCollections([a], [a, b, c], deleted).map((x) => x.uid), ['a', 'c'])
  // este lado la tiene y llegó la lápida de afuera
  assert.deepEqual(mergeCollections([a, b], [c], deleted).map((x) => x.uid), ['a', 'c'])
})

test('unión de lápidas conserva la fecha más nueva', () => {
  const merged = mergeDeleted({ x: '2026-01-01T00:00:00.000Z', y: '2026-03-01T00:00:00.000Z' }, { x: '2026-02-01T00:00:00.000Z' })
  assert.deepEqual(merged, { x: '2026-02-01T00:00:00.000Z', y: '2026-03-01T00:00:00.000Z' })
})

test('las lápidas viejas se olvidan', () => {
  const now = Date.parse('2026-09-25T00:00:00.000Z')
  const old = new Date(now - (TOMBSTONE_DAYS + 1) * 86400000).toISOString()
  const recent = new Date(now - 10 * 86400000).toISOString()
  assert.deepEqual(pruneDeleted({ old, recent }, now), { recent })
})
