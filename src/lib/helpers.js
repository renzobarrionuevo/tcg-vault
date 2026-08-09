/** Utilidades de presentación y precios. */

export const GAME_LABEL = { pk: 'Pokémon', op: 'One Piece' }

const VARIANT_LABELS = {
  Normal: 'Normal',
  Foil: 'Foil',
  normal: 'Normal',
  holofoil: 'Holofoil',
  reverseHolofoil: 'Reverse Holo',
  '1stEditionHolofoil': '1ª Ed. Holofoil',
  '1stEditionNormal': '1ª Edición',
  unlimited: 'Unlimited',
  unlimitedHolofoil: 'Unlimited Holofoil',
}

export function variantLabel(key) {
  return VARIANT_LABELS[key] || key
}

export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG']

export function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

/** Precio de mercado unitario actual de un item de la colección. */
export function marketOf(item) {
  return item.mkt ?? null
}

/** Totales de la colección: cartas, invertido, valor de mercado, ganancia. */
export function totals(items) {
  let cards = 0
  let invested = 0
  let value = 0
  let priced = 0
  for (const it of items) {
    const qty = it.qty || 1
    cards += qty
    if (it.paid != null) invested += it.paid * qty
    const m = marketOf(it)
    if (m != null) {
      value += m * qty
      priced += qty
    }
  }
  return { cards, invested, value, pl: value - invested, priced }
}

/** Elige la mejor variante por defecto (la que tenga precio de mercado). */
export function defaultVariant(variants) {
  const keys = Object.keys(variants || {})
  if (!keys.length) return null
  const withMarket = keys.find((k) => variants[k]?.market != null)
  return withMarket || keys[0]
}
