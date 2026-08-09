import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeCollections } from '../src/lib/storage.js'

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
