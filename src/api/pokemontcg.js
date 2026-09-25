/**
 * Cliente de pokemontcg.io (Pokémon TCG API v2).
 *
 * Desde que el pipeline genera un índice Pokémon local, esta API queda solo
 * como respaldo: búsqueda por id de pokemontcg.io ("sv4-123", que TCGPlayer
 * no conoce), búsqueda por nombre si el índice local no existe, y refresco de
 * precios de las cartas agregadas con versiones anteriores de la app
 * (source 'ptcg').
 *
 * API key opcional (gratis en dev.pokemontcg.io): sin key 1.000 req/día.
 */

import { loadSettings } from '../lib/storage.js'

const BASE = 'https://api.pokemontcg.io/v2'

function headers() {
  const { ptcgApiKey } = loadSettings()
  return ptcgApiKey ? { 'X-Api-Key': ptcgApiKey } : {}
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`pokemontcg.io respondió HTTP ${res.status}`)
  return res.json()
}

function normalize(card) {
  if (!card) return null
  const variants = {}
  for (const [k, v] of Object.entries(card.tcgplayer?.prices || {})) {
    variants[k] = { market: v.market ?? null, low: v.low ?? null, high: v.high ?? null }
  }
  return {
    source: 'ptcg',
    sourceId: card.id, // ej: "sv4-123"
    game: 'pk',
    name: card.name,
    set: card.set?.name || '',
    num: card.number && card.set?.printedTotal ? `${card.number}/${card.set.printedTotal}` : card.number || card.id,
    rarity: card.rarity || null,
    img: card.images?.small || card.images?.large || null,
    url: card.tcgplayer?.url || null,
    variants,
  }
}

/** Carta por id exacto, ej "sv4-123". */
export async function getCardById(id) {
  const data = await get(`/cards/${encodeURIComponent(id)}`)
  return normalize(data?.data)
}

/** Búsqueda por nombre (respaldo cuando no hay índice local). */
export async function searchByName(q, limit = 16) {
  const clean = q.replace(/["\\]/g, '').trim()
  if (!clean) return []
  // nombre con espacios → frase exacta; una palabra → prefijo
  const query = clean.includes(' ') ? `name:"${clean}"` : `name:${clean}*`
  const data = await get(`/cards?q=${encodeURIComponent(query)}&pageSize=${limit}&orderBy=-set.releaseDate`)
  return (data?.data || []).map(normalize).filter(Boolean)
}

/** Refresca precios: baja cada carta por id (secuencial, respeta rate limit). */
export async function refreshPtcgPrices(ids, onProgress) {
  const unique = [...new Set(ids)]
  const priceMap = new Map()
  for (let i = 0; i < unique.length; i++) {
    try {
      const card = await getCardById(unique[i])
      if (card) priceMap.set(unique[i], card.variants)
    } catch {
      // rate limit o error puntual: seguimos con las demás
    }
    onProgress?.(i + 1, unique.length)
    if (i < unique.length - 1) await new Promise((r) => setTimeout(r, 250))
  }
  return priceMap
}
