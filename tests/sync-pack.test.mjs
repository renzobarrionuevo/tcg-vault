import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packItems, unpackItems } from '../src/api/sync.js'

test('el historial va plano a Firestore (no admite arrays anidados) y vuelve en pares', () => {
  const items = [
    { uid: 'a', name: 'Sabo', hist: [[20720, 2.13], [20727, 2.2]] },
    { uid: 'b', name: 'Ace', hist: [] },
    { uid: 'c', name: 'Luffy' }, // sin historial (carta vieja)
  ]
  const packed = packItems(items)
  assert.deepEqual(packed[0].hist, [20720, 2.13, 20727, 2.2])
  assert.equal(packed[0].hist.some(Array.isArray), false, 'nada anidado')
  assert.deepEqual(packed[1].hist, [])
  assert.equal('hist' in packed[2], false)
  assert.deepEqual(unpackItems(packed), items)
  assert.notEqual(packed[0], items[0], 'no muta el original')
})

test('unpackItems tolera pares ya armados y documentos vacíos', () => {
  const items = [{ uid: 'a', hist: [[1, 2]] }]
  assert.deepEqual(unpackItems(items), items)
  assert.deepEqual(unpackItems(undefined), [])
})
