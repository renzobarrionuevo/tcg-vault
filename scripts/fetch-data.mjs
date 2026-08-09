#!/usr/bin/env node
/**
 * fetch-data.mjs — Descarga el catálogo y los precios oficiales de TCGPlayer
 * desde tcgcsv.com (dumps diarios) y genera JSON estáticos que la app lee
 * desde el mismo origen (sin CORS, sin API keys).
 *
 * Se ejecuta en GitHub Actions antes de cada build (deploy diario).
 *
 * Salida en public/data/:
 *   meta.json                → fecha de actualización + conteos
 *   products/{shard}.json    → productId → { n, g, set, img, num, r, p:{variante:{m,l,h}} }
 *   op-index.json            → índice de One Piece: códigos (OP01-001) y nombres
 *
 * Uso: node scripts/fetch-data.mjs [--only-group 68:23349]  (para pruebas)
 */

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'data')
const BASE = process.env.TCGCSV_BASE || 'https://tcgcsv.com/tcgplayer'
const SHARD_SIZE = 20000
const DELAY_MS = 120 // tcgcsv pide ~100ms entre requests

// categoryId de TCGPlayer → id corto de juego usado por la app
const CATEGORIES = [
  { id: 3, game: 'pk', label: 'Pokémon' },
  { id: 68, game: 'op', label: 'One Piece Card Game' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'tcg-vault (personal collection app)' } })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i === tries) {
        console.warn(`  ✗ ${url} → ${err.message} (omitido)`)
        return null
      }
      await sleep(1000 * i)
    }
  }
}

function ext(product, name) {
  const e = (product.extendedData || []).find((x) => x.name === name)
  return e ? e.value : undefined
}

function round(v) {
  return v == null ? null : Math.round(v * 100) / 100
}

async function main() {
  const onlyGroup = process.argv.includes('--only-group')
    ? process.argv[process.argv.indexOf('--only-group') + 1]
    : null

  const shards = new Map() // shardKey → { productId → entry }
  const opCodes = {} // "OP01-001" → [productId, ...]
  const opCards = [] // [code, name, set, productId] para búsqueda por nombre
  let totalProducts = 0
  let totalGroups = 0

  for (const cat of CATEGORIES) {
    console.log(`\n=== ${cat.label} (categoría ${cat.id}) ===`)
    const groupsRes = await fetchJson(`${BASE}/${cat.id}/groups`)
    if (!groupsRes?.results) {
      console.error(`No pude leer los grupos de la categoría ${cat.id}; se omite.`)
      continue
    }
    let groups = groupsRes.results
    if (onlyGroup) {
      const [c, g] = onlyGroup.split(':')
      groups = String(cat.id) === c ? groups.filter((x) => String(x.groupId) === g) : []
    }
    console.log(`${groups.length} sets/grupos`)

    for (const group of groups) {
      await sleep(DELAY_MS)
      const products = await fetchJson(`${BASE}/${cat.id}/${group.groupId}/products`)
      await sleep(DELAY_MS)
      const prices = await fetchJson(`${BASE}/${cat.id}/${group.groupId}/prices`)
      if (!products?.results) continue
      totalGroups++

      // precios por productId → { subTypeName → {m,l,h} }
      const priceMap = new Map()
      for (const p of prices?.results || []) {
        if (!priceMap.has(p.productId)) priceMap.set(p.productId, {})
        priceMap.get(p.productId)[p.subTypeName || 'Normal'] = {
          m: round(p.marketPrice),
          l: round(p.lowPrice),
          h: round(p.highPrice),
        }
      }

      for (const prod of products.results) {
        const num = ext(prod, 'Number')
        const entry = {
          n: prod.name,
          g: cat.game,
          set: group.name,
          img: prod.imageUrl || null,
          num: num || null,
          r: ext(prod, 'Rarity') || null,
          p: priceMap.get(prod.productId) || {},
        }
        const shardKey = Math.floor(prod.productId / SHARD_SIZE)
        if (!shards.has(shardKey)) shards.set(shardKey, {})
        shards.get(shardKey)[prod.productId] = entry
        totalProducts++

        // índice One Piece por código de carta (OP01-001, ST13-003, EB01-006…)
        if (cat.game === 'op' && num && /^[A-Z]+\d*-\d+$/i.test(num)) {
          const code = num.toUpperCase()
          if (!opCodes[code]) opCodes[code] = []
          opCodes[code].push(prod.productId)
          opCards.push([code, prod.name, group.name, prod.productId])
        }
      }
      process.stdout.write(`  ✓ ${group.name} (${products.results.length} productos)\n`)
    }
  }

  if (totalProducts === 0) {
    console.error('\nNo se descargó ningún producto; conservo los datos anteriores si existen.')
    process.exit(1)
  }

  await rm(join(OUT, 'products'), { recursive: true, force: true })
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
      products: totalProducts,
      groups: totalGroups,
      shards: [...shards.keys()].sort((a, b) => a - b),
    })
  )

  console.log(`\nListo: ${totalProducts} productos, ${totalGroups} grupos, ${shards.size} shards → public/data/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
