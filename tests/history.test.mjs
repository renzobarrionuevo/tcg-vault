import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordPrice, histOf, priceStats, collectionSeries, dayOf, HIST_MAX } from '../src/lib/helpers.js'

const D = (day) => new Date(day * 86400000).toISOString()

test('recordPrice: mismo día pisa, precio igual dentro de 7 días se omite, distinto se agrega', () => {
  let h = recordPrice([], 2.13, D(100))
  assert.deepEqual(h, [[100, 2.13]])
  h = recordPrice(h, 2.2, D(100)) // mismo día → reemplaza
  assert.deepEqual(h, [[100, 2.2]])
  h = recordPrice(h, 2.2, D(103)) // igual, hace 3 días → nada
  assert.deepEqual(h, [[100, 2.2]])
  h = recordPrice(h, 2.2, D(107)) // igual, pero ya pasaron 7 días → punto de continuidad
  assert.deepEqual(h, [[100, 2.2], [107, 2.2]])
  h = recordPrice(h, 2.5, D(108)) // distinto → se agrega
  assert.deepEqual(h, [[100, 2.2], [107, 2.2], [108, 2.5]])
  assert.deepEqual(recordPrice(h, null, D(109)), h, 'sin precio no cambia nada')
})

test('recordPrice: no pasa de HIST_MAX puntos (se van los más viejos)', () => {
  let h = []
  for (let i = 0; i < HIST_MAX + 5; i++) h = recordPrice(h, i, D(i))
  assert.equal(h.length, HIST_MAX)
  assert.equal(h[0][0], 5)
})

test('histOf: las cartas viejas arrancan con su último precio conocido', () => {
  assert.deepEqual(histOf({ mkt: 3, mktAt: D(50) }), [[50, 3]])
  assert.deepEqual(histOf({ mkt: 3, mktAt: D(50), hist: [[40, 2]] }), [[40, 2]])
  assert.deepEqual(histOf({}), [])
})

test('priceStats: variación contra lo pagado y contra el primer registro', () => {
  const s = priceStats({ paid: 1.5, mkt: 2.13, mktAt: D(60), hist: [[50, 2.0], [60, 2.13]] })
  assert.equal(s.now, 2.13)
  assert.ok(Math.abs(s.vsPaid.abs - 0.63) < 1e-9)
  assert.ok(Math.abs(s.vsPaid.pct - 0.42) < 1e-9)
  assert.equal(s.vsFirst.since, 50)
  assert.ok(Math.abs(s.vsFirst.abs - 0.13) < 1e-9)
  assert.equal(priceStats({ mkt: 2 }).vsPaid, null)
})

test('collectionSeries: suma el último precio conocido de cada carta por día', () => {
  const items = [
    { qty: 2, paid: 1, addedAt: D(10), hist: [[10, 1.5], [12, 2]] },
    { qty: 1, paid: null, addedAt: D(11), hist: [[11, 10]] },
    { qty: 1, paid: 5, addedAt: D(13), hist: [] }, // sin precio: invertido sí, valor no
  ]
  const s = collectionSeries(items, 13)
  assert.deepEqual(
    s.map((d) => [d.day, d.value, d.invested]),
    [
      [10, 3, 2],
      [11, 13, 2],
      [12, 14, 2],
      [13, 14, 7],
    ]
  )
  assert.deepEqual(collectionSeries([], 13), [])
})

test('dayOf redondea hacia abajo al día UTC', () => {
  assert.equal(dayOf('1970-01-02T23:59:59.000Z'), 1)
})
