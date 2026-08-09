#!/usr/bin/env node
/**
 * Genera un mini dataset de ejemplo en public/data/ con la MISMA estructura
 * que scripts/fetch-data.mjs, para desarrollo/pruebas sin red.
 * (Datos reales de muestra tomados de tcgcsv.com el 2026-08-09.)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const SHARD_SIZE = 20000

const products = {
  // One Piece — ST-13 Ultra Deck: The Three Brothers
  543603: {
    n: 'Sabo (001)',
    g: 'op',
    set: 'Ultra Deck: The Three Brothers',
    img: 'https://tcgplayer-cdn.tcgplayer.com/product/543603_200w.jpg',
    num: 'ST13-001',
    r: 'L',
    p: { Foil: { m: 2.13, l: 1.8, h: 25.0 } },
  },
  543595: {
    n: 'Ultra Deck: The Three Brothers',
    g: 'op',
    set: 'Ultra Deck: The Three Brothers',
    img: 'https://tcgplayer-cdn.tcgplayer.com/product/543595_200w.jpg',
    num: null,
    r: null,
    p: { Normal: { m: 79.29, l: 71.0, h: 154.95 } },
  },
  // Pokémon — ejemplo con dos variantes
  610001: {
    n: 'Brute Bonnet',
    g: 'pk',
    set: 'SV04: Paradox Rift',
    img: 'https://tcgplayer-cdn.tcgplayer.com/product/610001_200w.jpg',
    num: '123/182',
    r: 'Rare',
    p: { Normal: { m: 0.18, l: 0.05, h: 2.5 }, 'Reverse Holofoil': { m: 0.32, l: 0.1, h: 3.0 } },
  },
}

const opCodes = { 'ST13-001': [543603] }
const opCards = [['ST13-001', 'Sabo (001)', 'Ultra Deck: The Three Brothers', 543603]]

const shards = new Map()
for (const [pid, entry] of Object.entries(products)) {
  const key = Math.floor(Number(pid) / SHARD_SIZE)
  if (!shards.has(key)) shards.set(key, {})
  shards.get(key)[pid] = entry
}

await mkdir(join(OUT, 'products'), { recursive: true })
for (const [key, obj] of shards) {
  await writeFile(join(OUT, 'products', `${key}.json`), JSON.stringify(obj))
}
await writeFile(join(OUT, 'op-index.json'), JSON.stringify({ codes: opCodes, cards: opCards }))
await writeFile(
  join(OUT, 'meta.json'),
  JSON.stringify({
    updatedAt: new Date().toISOString(),
    shardSize: SHARD_SIZE,
    products: Object.keys(products).length,
    groups: 2,
    shards: [...shards.keys()].sort((a, b) => a - b),
    fixture: true,
  })
)
console.log('Fixtures listos en public/data/ (dataset de ejemplo, NO datos completos).')
