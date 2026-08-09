/**
 * Cliente de los datos estáticos generados por scripts/fetch-data.mjs
 * (precios oficiales de TCGPlayer vía tcgcsv.com, actualizados a diario
 * por GitHub Actions). Todo se sirve desde el mismo origen → sin CORS.
 */

const DATA_BASE = `${import.meta.env.BASE_URL}data`

let shardSize = 20000
let metaPromise = null
const shardCache = new Map()
let opIndexPromise = null

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

function loadOpIndex() {
  if (!opIndexPromise) {
    opIndexPromise = fetchLocal('op-index.json').catch(() => ({ codes: {}, cards: [] }))
  }
  return opIndexPromise
}

/** entrada cruda del shard → resultado normalizado para la app */
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
    img: e.img,
    url: `https://www.tcgplayer.com/product/${productId}`,
    variants,
  }
}

/** Busca un producto por productId de TCGPlayer (de la URL pegada). */
export async function getByProductId(productId, { fresh = false } = {}) {
  const shard = await loadShard(productId, { fresh })
  return normalize(productId, shard[productId])
}

/** Busca cartas One Piece por código exacto (OP01-001). Devuelve todas las variantes (normal / alt-art / manga…). */
export async function getOpByCode(code) {
  const idx = await loadOpIndex()
  const ids = idx.codes[code] || []
  const results = await Promise.all(ids.map((id) => getByProductId(id)))
  return results.filter(Boolean)
}

/** Búsqueda por nombre dentro de One Piece (índice local). */
export async function searchOpByName(q, limit = 24) {
  const idx = await loadOpIndex()
  const needle = q.toLowerCase()
  const hits = []
  for (const [code, name, set, pid] of idx.cards) {
    if (name.toLowerCase().includes(needle)) {
      hits.push({ code, name, set, pid })
      if (hits.length >= limit) break
    }
  }
  const results = await Promise.all(hits.map((h) => getByProductId(h.pid)))
  return results.filter(Boolean)
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
