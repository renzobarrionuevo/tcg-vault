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

/**
 * Rarezas por juego, ordenadas de la más buscada a la menos.
 * El orden de estos arrays es el que manda en la UI: reordenar acá alcanza.
 *
 * One Piece — [código, nombre]. La escalera clásica es C < UC < R < SR < SEC.
 * Aparte quedan TR (Treasure Rare), primera por ser la más escasa del catálogo
 * —11 cartas sobre 7243 productos—, L (Leader), más escasa que R pero menos
 * codiciada que SR, y PR / DON!!, que no son niveles de rareza sino tipos de
 * carta, así que van al final.
 */
const OP_RARITIES = [
  ['TR', 'Treasure Rare'],
  ['SEC', 'Secret Rare'],
  ['SR', 'Super Rare'],
  ['L', 'Leader'],
  ['R', 'Rare'],
  ['UC', 'Uncommon'],
  ['C', 'Common'],
  ['PR', 'Promo'],
  ['DON!!', 'Carta DON!!'],
]

/**
 * Pokémon — [valor de TCGPlayer, símbolo, sigla, nombre, color del símbolo].
 *
 * SÍMBOLO. Los de las tres rarezas base son los que van impresos en la carta:
 * ● Common, ◆ Uncommon, ★ Rare. Para el resto no hay un símbolo único y
 * estable entre eras, así que se extiende ese sistema por escalón:
 * ★ una estrella, ★★ dos, ★★★ las de nivel secreto. Es una convención nuestra,
 * no el símbolo oficial de cada subtipo.
 *
 * COLOR. Imita el color con el que el símbolo va impreso en la carta:
 *   tinta    — negro sobre la carta. Acá se dibuja claro: un símbolo negro
 *              sobre el fondo oscuro de la app sería invisible.
 *   oro      — las doradas (Hyper, Secret, las Illustration Rare).
 *   plata    — las plateadas/holográficas (Ultra Rare, Shiny, Prism…).
 *   arcoiris — degradado, para Rainbow Rare.
 *   gris     — lo que no es una rareza (Code Card, sin confirmar).
 * Así el color dice el acabado y el símbolo dice el escalón, igual que en la
 * carta real: ● ◆ ★ comparten el negro y se distinguen por la forma.
 *
 * Promo, Code Card y Unconfirmed no son niveles de rareza: van al final.
 * El vocabulario salió de barrer los 217 sets de tcgcsv (32.547 productos).
 */
const PK_RARITIES = [
  ['MEGA HYPER RARE', '★★★', 'M.HYP', 'Mega Hyper Rare', 'oro'],
  ['HYPER RARE', '★★★', 'HYP', 'Hyper Rare (dorada)', 'oro'],
  ['RAINBOW RARE', '★★★', 'RNB', 'Rainbow Rare', 'arcoiris'],
  ['SECRET RARE', '★★★', 'SEC', 'Secret Rare', 'oro'],
  ['BLACK WHITE RARE', '★★★', 'BWR', 'Black White Rare', 'arcoiris'],
  ['SPECIAL ILLUSTRATION RARE', '★★', 'SIR', 'Special Illustration Rare', 'oro'],
  ['MEGA ATTACK RARE', '★★', 'M.ATK', 'Mega Attack Rare', 'oro'],
  ['SHINY ULTRA RARE', '★★', 'S.UR', 'Shiny Ultra Rare', 'plata'],
  ['ULTRA RARE', '★★', 'UR', 'Ultra Rare', 'plata'],
  ['ILLUSTRATION RARE', '★', 'IR', 'Illustration Rare', 'oro'],
  ['ACE SPEC RARE', '★', 'ACE', 'ACE SPEC Rare', 'plata'],
  ['AMAZING RARE', '★', 'AMZ', 'Amazing Rare', 'plata'],
  ['RADIANT RARE', '★', 'RAD', 'Radiant Rare', 'plata'],
  ['PRISM RARE', '★', 'PRI', 'Prism Rare', 'plata'],
  ['SHINY HOLO RARE', '★', 'S.HOL', 'Shiny Holo Rare', 'plata'],
  ['SHINY RARE', '★', 'SHY', 'Shiny Rare', 'plata'],
  ['DOUBLE RARE', '★★', 'RR', 'Double Rare (ex)', 'tinta'],
  ['RARE ACE', '★', 'R.ACE', 'Rare Ace', 'tinta'],
  ['RARE BREAK', '★', 'BRK', 'Rare BREAK', 'tinta'],
  ['FUTURISTIC RARE', '★', 'FUT', 'Futuristic Rare', 'tinta'],
  ['CLASSIC COLLECTION', '★', 'CLA', 'Classic Collection', 'tinta'],
  ['HOLO RARE', '★', 'HOL', 'Holo Rare', 'tinta'],
  ['RARE', '★', 'R', 'Rare', 'tinta'],
  ['UNCOMMON', '◆', 'UC', 'Uncommon', 'tinta'],
  ['COMMON', '●', 'C', 'Common', 'tinta'],
  ['PROMO', '✦', 'PR', 'Promo', 'tinta'],
  ['CODE CARD', '▪', 'COD', 'Code Card (código online)', 'gris'],
  ['UNCONFIRMED', '', '?', 'Rareza sin confirmar por TCGPlayer', 'gris'],
]

/** 'DON!!' → 'don', '—' → 'none'. Para la clase CSS del chip. */
function slug(code) {
  return code === '—' ? 'none' : code.toLowerCase().replace(/[^a-z0-9]/g, '') || 'none'
}

const SIN_RAREZA = {
  label: '—',
  name: 'Sin rareza (mazos, cajas y productos que no son cartas)',
  cls: 'r-none',
}

const META = {
  op: Object.fromEntries(
    OP_RARITIES.map(([code, name]) => [code, { label: code, name, cls: `r-${slug(code)}` }])
  ),
  pk: Object.fromEntries(
    PK_RARITIES.map(([raw, sym, short, name, color]) => [raw, { sym, label: short, name, cls: `r-${color}` }])
  ),
}

export const RARITY_ORDER = {
  op: OP_RARITIES.map(([code]) => code),
  pk: PK_RARITIES.map(([raw]) => raw),
}

/** Cómo se dibuja el chip de una rareza. Las desconocidas se muestran crudas. */
export function rarityMeta(game, code) {
  if (code === '—') return SIN_RAREZA
  return META[game]?.[code] || { label: code, name: code, cls: 'r-none' }
}

/**
 * Cuenta cartas por rareza sumando cantidades, en el orden del juego.
 * Las rarezas que no estén en la lista van después de las conocidas, y las
 * cartas sin rareza se agrupan al final bajo '—' (así los chips suman igual
 * que el total de "Cartas"). Pokémon usa el literal "None" para eso, que se
 * mete en el mismo grupo.
 */
export function rarityCounts(items, game) {
  const order = RARITY_ORDER[game]
  if (!order) return []

  const counts = new Map()
  for (const it of items) {
    let key = (it.rarity || '').trim().toUpperCase()
    if (!key || key === 'NONE') key = '—'
    counts.set(key, (counts.get(key) || 0) + (it.qty || 1))
  }

  const rank = (k) => {
    const i = order.indexOf(k)
    if (i >= 0) return i
    return k === '—' ? order.length + 1 : order.length // desconocidas antes que "sin rareza"
  }

  return [...counts.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([code, count]) => ({ code, count }))
}

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
