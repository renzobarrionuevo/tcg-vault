import { test } from 'node:test'
import assert from 'node:assert/strict'
import { totals, rarityCounts } from '../src/lib/helpers.js'

test('la ganancia solo compara cartas con precio pagado y de mercado', () => {
  const t = totals([
    { qty: 2, paid: 1, mkt: 3 }, // +4
    { qty: 1, paid: null, mkt: 10 }, // sin pagado: suma al valor, no a la ganancia
    { qty: 3, paid: 2, mkt: null }, // sin mercado: suma a invertido, no a la ganancia
  ])
  assert.equal(t.cards, 6)
  assert.equal(t.value, 16)
  assert.equal(t.invested, 8)
  assert.equal(t.pl, 4)
  assert.equal(t.priced, 3)
})

test('rarezas de pokemontcg.io se traducen al vocabulario de TCGPlayer', () => {
  const rows = rarityCounts(
    [
      { rarity: 'Holo Rare', qty: 1 }, // tcgcsv
      { rarity: 'Rare Holo', qty: 2 }, // pokemontcg.io, misma rareza
      { rarity: 'Rare Ultra', qty: 1 },
    ],
    'pk'
  )
  assert.deepEqual(rows, [
    { code: 'ULTRA RARE', count: 1 },
    { code: 'HOLO RARE', count: 3 },
  ])
})

test('la imagen grande se deduce de la miniatura', async () => {
  const { largeImage } = await import('../src/lib/helpers.js')
  assert.equal(
    largeImage('https://tcgplayer-cdn.tcgplayer.com/product/543603_200w.jpg'),
    'https://tcgplayer-cdn.tcgplayer.com/product/543603_in_1000x1000.jpg'
  )
  assert.equal(largeImage('https://images.pokemontcg.io/sv4/123.png'), 'https://images.pokemontcg.io/sv4/123_hires.png')
  assert.equal(largeImage('https://otro.cdn/x.jpg'), 'https://otro.cdn/x.jpg')
  assert.equal(largeImage(null), null)
})
