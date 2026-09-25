/**
 * Cliente de los datos estáticos generados por scripts/fetch-data.mjs
 * (precios oficiales de TCGPlayer vía tcgcsv.com, actualizados a diario
 * por GitHub Actions). Todo se sirve desde el mismo origen → sin CORS.
 *
 * Dos tipos de archivo:
 *  - {pk|op}-index.json: índice liviano por juego para buscar por nombre o
 *    código. Sus resultados NO traen precios: se completan con
 *    getByProductId() recién cuando el usuario elige una carta.
 *  - products/{shard}.json: fichas completas (precios incluidos), agrupadas
 *    por rango de productId.
 */

const DATA_BASE = `${import.meta.env.BASE_URL}data`

let shardSize = 10000
let metaPromise = null
const shardCache = new Map()
const indexCache = new Map() // game → Promise<{sets, cards}>

async function fetchLocal(path, { fresh = false } = {}) {
  const res = await fetch(`${DATA_BASE}/${path}`, fresh ? { cache: 'no-cache' } : {})
  if (!res.ok) throw new Error(`No pude leer ${path} (HTTP ${res.status})`)
  return res.json()
}

export function getMeta() {
  if (!metaPromise) {
    metaPromise = fetchLocal('meta.json', { fresh: true })
      .then((m) => {
        if (m?.shardSize) shardSize = m.shardSize
        return m
      })
      .catch(() => null)
  }
  return metaPromise
}

async function loadShard(productId, { fresh = false } = {}) {
  await getMeta()
  const key = Math.floor(productId / shardSize)
  if (fresh || !shardCache.has(key)) {
    shardCache.set(
      key,
      fetchLocal(`products/${key}.json`, { fresh }).catch(() => ({}))
    )
  }
  return shardCache.get(key)
}

function loadIndex(game) {
  if (!indexCache.has(game)) {
    indexCache.set(
      game,
      fetchLocal(`${game}-index.json`).catch(() => ({ sets: [], cards: [] }))
    )
  }
  return indexCache.get(game)
}

/** ¿Hay índice local para este juego? (falso si los datos no se generaron) */
export async function hasIndex(game) {
  const idx = await loadIndex(game)
  return idx.cards.length > 0
}

/** Imagen estándar del CDN de TCGPlayer; el pipeline no la guarda porque se deduce del id. */
export function imageUrl(productId) {
  return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`
}

function productUrl(productId) {
  return `https://www.tcgplayer.com/product/${productId}`
}

/** entrada cruda del shard → ficha completa normalizada para la app */
function normalize(productId, e) {
  if (!e) return null
  const variants = {}
  for (const [k, v] of Object.entries(e.p || {})) {
    variants[k] = { market: v.m, low: v.l, high: v.h }
  }
  return {
    source: 'csv',
    sourceId: Number(productId),
    game: e.g, // 'pk' | 'op'
    name: e.n,
    set: e.set,
    num: e.num,
    rarity: e.r,
    img: 'img' in e ? e.img : imageUrl(productId),
    url: productUrl(productId),
    variants,
  }
}

/** entrada del índice → resultado liviano (sin `variants`; ver getByProductId) */
function fromIndex(game, idx, [name, setIdx, num, pid]) {
  return {
    source: 'csv',
    sourceId: pid,
    game,
    name,
    set: idx.sets[setIdx] || '',
    num,
    img: imageUrl(pid),
    url: productUrl(pid),
  }
}

/** Ficha completa por productId de TCGPlayer (de la URL pegada o de un resultado del índice). */
export async function getByProductId(productId, { fresh = false } = {}) {
  const shard = await loadShard(productId, { fresh })
  return normalize(productId, shard[productId])
}

/** Cartas One Piece por código exacto (OP01-001): todas las versiones (normal / alt-art / manga…). */
export async function getOpByCode(code) {
  const idx = await loadIndex('op')
  return idx.cards.filter((c) => c[2] === code).map((c) => fromIndex('op', idx, c))
}

/**
 * Búsqueda por nombre en el índice local del juego. Todas las palabras tienen
 * que aparecer en el nombre o el número ("charizard 125"). El índice viene
 * ordenado del set más nuevo al más viejo, así que los primeros resultados
 * son los más recientes.
 */
export async function searchByName(game, q, limit = 30) {
  const idx = await loadIndex(game)
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits = []
  for (const c of idx.cards) {
    const hay = `${c[0]} ${c[2] || ''}`.toLowerCase()
    if (words.every((w) => hay.includes(w))) {
      hits.push(fromIndex(game, idx, c))
      if (hits.length >= limit) break
    }
  }
  return hits
}

/**
 * Refresca precios de items 'csv': agrupa por shard, baja cada shard una vez
 * (sin caché del navegador) y devuelve un mapa productId → variants.
 */
export async function refreshCsvPrices(productIds) {
  const unique = [...new Set(productIds)]
  await getMeta()
  const byShard = new Map()
  for (const pid of unique) {
    const key = Math.floor(pid / shardSize)
    if (!byShard.has(key)) byShard.set(key, [])
    byShard.get(key).push(pid)
  }
  const priceMap = new Map()
  for (const [, pids] of byShard) {
    const shard = await loadShard(pids[0], { fresh: true })
    for (const pid of pids) {
      const norm = normalize(pid, shard[pid])
      if (norm) priceMap.set(pid, norm.variants)
    }
  }
  return priceMap
}
