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
 *   products/{shard}.json    → productId → { n, g, set, num, r, p:{variante:{m,l,h}} [, img] }
 *                              `img` solo va cuando NO es la URL estándar del CDN
 *                              (https://tcgplayer-cdn.tcgplayer.com/product/{id}_200w.jpg);
 *                              el cliente la reconstruye a partir del productId.
 *   {pk|op}-index.json       → índice de búsqueda por nombre/número de cada juego:
 *                              { sets: [nombre…], abbr: [abreviatura…], cards: [[nombre, iSet, num, productId]…] }
 *                              ordenado del set más nuevo al más viejo. Para One
 *                              Piece `num` es el código de carta (OP01-001); para
 *                              Pokémon es "125/182" y la abreviatura del set (PAR)
 *                              permite buscar "PAR 125".
 *
 * Uso: node scripts/fetch-data.mjs [--only-group 68:23349]  (para pruebas)
 */

import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'data')
const BASE = process.env.TCGCSV_BASE || 'https://tcgcsv.com/tcgplayer'
export const SHARD_SIZE = 10000
const DELAY_MS = 120 // tcgcsv pide ~100ms entre requests
// si falla más que esto de los sets de un juego, el catálogo quedaría
// incompleto y pisaría uno bueno: mejor abortar y conservar el deploy anterior
const MAX_FAILED_GROUPS_RATIO = 0.05

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

/** URL de imagen que el cliente sabe reconstruir solo (no hace falta guardarla). */
export function defaultImage(productId) {
  return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`
}

/**
 * TCGPlayer repite el número en el nombre de las cartas Pokémon
 * ("Miraidon ex - 081/198"). Como el número va aparte, se lo saca del nombre.
 */
export function cleanName(name, num) {
  if (!num) return name
  const suffix = ` - ${num}`
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
}

async function main() {
  const onlyGroup = process.argv.includes('--only-group')
    ? process.argv[process.argv.indexOf('--only-group') + 1]
    : null

  const shards = new Map() // shardKey → { productId → entry }
  const indexes = {} // game → { sets: [], cards: [] }
  let totalProducts = 0
  let totalGroups = 0

  for (const cat of CATEGORIES) {
    console.log(`\n=== ${cat.label} (categoría ${cat.id}) ===`)
    const groupsRes = await fetchJson(`${BASE}/${cat.id}/groups`)
    if (!groupsRes?.results) {
      console.error(`No pude leer los grupos de la categoría ${cat.id}; abortando para no publicar un catálogo incompleto.`)
      process.exit(1)
    }
    let groups = groupsRes.results
    if (onlyGroup) {
      const [c, g] = onlyGroup.split(':')
      groups = String(cat.id) === c ? groups.filter((x) => String(x.groupId) === g) : []
    }
    // del set más nuevo al más viejo: así el índice de búsqueda ya queda ordenado
    groups.sort((a, b) => String(b.publishedOn || '').localeCompare(String(a.publishedOn || '')))
    console.log(`${groups.length} sets/grupos`)

    const index = { sets: [], abbr: [], cards: [] }
    indexes[cat.game] = index
    let failed = 0
    let catProducts = 0

    for (const group of groups) {
      await sleep(DELAY_MS)
      const products = await fetchJson(`${BASE}/${cat.id}/${group.groupId}/products`)
      await sleep(DELAY_MS)
      const prices = await fetchJson(`${BASE}/${cat.id}/${group.groupId}/prices`)
      if (!products?.results) {
        failed++
        continue
      }
      totalGroups++
      const setIdx = index.sets.push(group.name) - 1
      index.abbr.push(group.abbreviation || '')

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

      // dentro del set, primero las cartas (tienen número) y después lo
      // sellado (cajas, mazos), que es lo que menos se busca por nombre
      const prods = [...products.results].sort((a, b) => (ext(a, 'Number') ? 0 : 1) - (ext(b, 'Number') ? 0 : 1))
      for (const prod of prods) {
        const num = ext(prod, 'Number') || null
        const name = cleanName(prod.name, num)
        const entry = {
          n: name,
          g: cat.game,
          set: group.name,
          num,
          r: ext(prod, 'Rarity') || null,
          p: priceMap.get(prod.productId) || {},
        }
        const img = prod.imageUrl || null
        if (img !== defaultImage(prod.productId)) entry.img = img

        const shardKey = Math.floor(prod.productId / SHARD_SIZE)
        if (!shards.has(shardKey)) shards.set(shardKey, {})
        shards.get(shardKey)[prod.productId] = entry
        totalProducts++
        catProducts++

        // One Piece: el código de carta (OP01-001) va normalizado en mayúsculas
        const key = cat.game === 'op' && num && /^[A-Z]+\d*-\d+$/i.test(num) ? num.toUpperCase() : num
        index.cards.push([name, setIdx, key, prod.productId])
      }
      process.stdout.write(`  ✓ ${group.name} (${products.results.length} productos)\n`)
    }

    if (groups.length && catProducts === 0) {
      console.error(`\n${cat.label}: no se descargó ningún producto; abortando.`)
      process.exit(1)
    }
    if (failed > groups.length * MAX_FAILED_GROUPS_RATIO) {
      console.error(`\n${cat.label}: fallaron ${failed} de ${groups.length} sets; abortando para no publicar un catálogo incompleto.`)
      process.exit(1)
    }
    if (failed) console.warn(`${cat.label}: ${failed} set(s) omitidos por errores de red.`)
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
  for (const [game, index] of Object.entries(indexes)) {
    await writeFile(join(OUT, `${game}-index.json`), JSON.stringify(index))
  }
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

// solo corre como script; los tests importan las funciones de arriba
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
