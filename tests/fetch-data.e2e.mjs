/**
 * Prueba del pipeline scripts/fetch-data.mjs contra un servidor local que
 * imita los endpoints de tcgcsv.com (mismas estructuras JSON reales).
 * Uso: node tests/fetch-data.e2e.mjs   (no forma parte de `npm test`)
 * Deja fixtures en public/data/; para volver al dataset de ejemplo:
 * node scripts/make-fixtures.mjs
 */
import http from 'node:http'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const groups68 = { totalItems: 1, success: true, errors: [], results: [{ groupId: 23349, name: 'Ultra Deck: The Three Brothers', abbreviation: 'ST13', categoryId: 68, publishedOn: '2024-11-01T00:00:00' }] }
const groups3 = {
  totalItems: 2, success: true, errors: [], results: [
    { groupId: 22873, name: 'SV01: Scarlet & Violet Base Set', abbreviation: 'SVI', categoryId: 3, publishedOn: '2023-03-31T00:00:00' },
    { groupId: 23286, name: 'SV04: Paradox Rift', abbreviation: 'PAR', categoryId: 3, publishedOn: '2023-11-03T00:00:00' },
  ],
}
const products68 = {
  success: true, errors: [], results: [
    { productId: 543603, name: 'Sabo (001)', imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/543603_200w.jpg', categoryId: 68, groupId: 23349, url: 'https://www.tcgplayer.com/product/543603/x', extendedData: [{ name: 'Rarity', value: 'L' }, { name: 'Number', value: 'st13-001' }] },
    { productId: 543595, name: 'Ultra Deck: The Three Brothers', imageUrl: 'https://img/custom.jpg', categoryId: 68, groupId: 23349, url: 'https://www.tcgplayer.com/product/543595/x', extendedData: [] },
  ],
}
const prices68 = { success: true, errors: [], results: [
  { productId: 543603, lowPrice: 1.8, midPrice: 2.79, highPrice: 25.0, marketPrice: 2.13, directLowPrice: null, subTypeName: 'Foil' },
  { productId: 543595, lowPrice: 71.0, midPrice: 87.24, highPrice: 154.95, marketPrice: 79.29, directLowPrice: null, subTypeName: 'Normal' },
] }
const products3 = { success: true, errors: [], results: [
  { productId: 477892, name: 'Miraidon ex - 081/198', imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/477892_200w.jpg', categoryId: 3, groupId: 22873, url: 'https://www.tcgplayer.com/product/477892/x', extendedData: [{ name: 'Rarity', value: 'Double Rare' }, { name: 'Number', value: '081/198' }] },
] }
const prices3 = { success: true, errors: [], results: [
  { productId: 477892, lowPrice: 0.5, midPrice: 1.2, highPrice: 10, marketPrice: 0.95, directLowPrice: 0.6, subTypeName: 'Holofoil' },
] }
const productsPar = { success: true, errors: [], results: [
  { productId: 610001, name: 'Brute Bonnet - 123/182', imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/610001_200w.jpg', categoryId: 3, groupId: 23286, url: 'x', extendedData: [{ name: 'Rarity', value: 'Rare' }, { name: 'Number', value: '123/182' }] },
] }
const pricesPar = { success: true, errors: [], results: [
  { productId: 610001, lowPrice: 0.05, midPrice: 0.2, highPrice: 2.5, marketPrice: 0.18, directLowPrice: null, subTypeName: 'Normal' },
] }

const routes = {
  '/3/groups': groups3,
  '/68/groups': groups68,
  '/68/23349/products': products68,
  '/68/23349/prices': prices68,
  '/3/22873/products': products3,
  '/3/22873/prices': prices3,
  '/3/23286/products': productsPar,
  '/3/23286/prices': pricesPar,
}

const server = http.createServer((req, res) => {
  const body = routes[req.url]
  if (!body) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body))
})

await new Promise((r) => server.listen(0, r))
const port = server.address().port

console.log(`Servidor fake tcgcsv en :${port} — ejecutando fetch-data.mjs…`)
// spawn asíncrono: el servidor fake vive en este proceso y necesita el event loop libre
const code = await new Promise((resolve) => {
  const child = spawn('node', [join(ROOT, 'scripts', 'fetch-data.mjs')], {
    env: { ...process.env, TCGCSV_BASE: `http://127.0.0.1:${port}` },
    stdio: 'inherit',
  })
  child.on('close', resolve)
})
server.close()
assert.equal(code, 0, 'fetch-data.mjs terminó con error')

// ── verificaciones ──
const meta = JSON.parse(await readFile(join(ROOT, 'public/data/meta.json'), 'utf8'))
assert.equal(meta.products, 4, 'meta.products')
assert.equal(meta.shardSize, 10000)

const shard54 = JSON.parse(await readFile(join(ROOT, 'public/data/products/54.json'), 'utf8'))
assert.equal(shard54['543603'].n, 'Sabo (001)')
assert.equal(shard54['543603'].num, 'st13-001', 'el shard conserva el número tal cual')
assert.equal('img' in shard54['543603'], false, 'imagen estándar del CDN no se guarda')
assert.equal(shard54['543595'].img, 'https://img/custom.jpg', 'imagen no estándar sí se guarda')
assert.deepEqual(shard54['543603'].p.Foil, { m: 2.13, l: 1.8, h: 25 })

const shard47 = JSON.parse(await readFile(join(ROOT, 'public/data/products/47.json'), 'utf8'))
assert.equal(shard47['477892'].g, 'pk')
assert.equal(shard47['477892'].n, 'Miraidon ex', 'el número se saca del nombre Pokémon')
assert.deepEqual(shard47['477892'].p.Holofoil, { m: 0.95, l: 0.5, h: 10 })

const opIndex = JSON.parse(await readFile(join(ROOT, 'public/data/op-index.json'), 'utf8'))
assert.deepEqual(opIndex.sets, ['Ultra Deck: The Three Brothers'])
assert.deepEqual(opIndex.abbr, ['ST13'])
assert.deepEqual(opIndex.cards, [
  ['Sabo (001)', 0, 'ST13-001', 543603], // código normalizado a mayúsculas
  ['Ultra Deck: The Three Brothers', 0, null, 543595], // sellado: entra al índice sin código
])

const pkIndex = JSON.parse(await readFile(join(ROOT, 'public/data/pk-index.json'), 'utf8'))
assert.deepEqual(pkIndex.sets, ['SV04: Paradox Rift', 'SV01: Scarlet & Violet Base Set'], 'sets del más nuevo al más viejo')
assert.deepEqual(pkIndex.abbr, ['PAR', 'SVI'], 'abreviaturas en el mismo orden')
assert.deepEqual(pkIndex.cards, [
  ['Brute Bonnet', 0, '123/182', 610001],
  ['Miraidon ex', 1, '081/198', 477892],
])

console.log('\n✓ Pipeline fetch-data.mjs OK: shards, índices por juego y meta generados correctamente.')
