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

/**
 * pokemontcg.io (cartas agregadas con versiones viejas de la app) usa otro
 * vocabulario que TCGPlayer: "Rare Holo" en vez de "Holo Rare", etc. Se
 * traduce al de tcgcsv para que la misma rareza no salga en dos chips.
 */
const PK_RARITY_ALIASES = {
  'RARE HOLO': 'HOLO RARE',
  'RARE ULTRA': 'ULTRA RARE',
  'RARE SECRET': 'SECRET RARE',
  'RARE RAINBOW': 'RAINBOW RARE',
  'RARE SHINY': 'SHINY RARE',
  'RARE SHINY GX': 'SHINY ULTRA RARE',
  'RARE PRISM STAR': 'PRISM RARE',
  'RARE HOLO EX': 'ULTRA RARE',
  'RARE HOLO GX': 'ULTRA RARE',
  'RARE HOLO V': 'ULTRA RARE',
  'RARE HOLO VMAX': 'ULTRA RARE',
  'RARE HOLO VSTAR': 'ULTRA RARE',
  'RARE HOLO LV.X': 'ULTRA RARE',
  'TRAINER GALLERY RARE HOLO': 'HOLO RARE',
}

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
    if (game === 'pk') key = PK_RARITY_ALIASES[key] || key
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

/**
 * Versión grande de la imagen guardada (que es la miniatura de 200 px).
 * TCGPlayer sirve la misma foto en 1000 px; pokemontcg.io tiene un _hires.
 * Si no reconoce la URL, devuelve la misma.
 */
export function largeImage(img) {
  if (!img) return null
  return img
    .replace(/(tcgplayer-cdn\.tcgplayer\.com\/product\/\d+)_200w\.jpg$/, '$1_in_1000x1000.jpg')
    .replace(/(images\.pokemontcg\.io\/[^/]+\/[^/_]+)\.png$/, '$1_hires.png')
}

/** Precio de mercado unitario actual de un item de la colección. */
export function marketOf(item) {
  return item.mkt ?? null
}

/**
 * Totales de la colección: cartas, valor de mercado, variación desde que se
 * agregó cada carta (su precio de mercado de ese día × cantidad), y, si se
 * cargó precio pagado, invertido y ganancia (pl). La ganancia compara solo
 * las cartas que tienen precio pagado Y de mercado: una carta sin precio
 * pagado no es "toda ganancia".
 */
export function totals(items) {
  let cards = 0
  let invested = 0
  let value = 0
  let priced = 0
  let pl = 0
  let initial = 0 // valor de mercado al agregarlas, de las que tienen precio hoy
  let change = 0
  for (const it of items) {
    const qty = it.qty || 1
    cards += qty
    if (it.paid != null) invested += it.paid * qty
    const m = marketOf(it)
    if (m != null) {
      value += m * qty
      priced += qty
      if (it.paid != null) pl += (m - it.paid) * qty
      const first = histOf(it)[0]
      if (first) {
        initial += first[1] * qty
        change += (m - first[1]) * qty
      }
    }
  }
  return { cards, invested, value, pl, priced, initial, change }
}

/** Clase de color de una variación: verde sube, rojo baja, nada si no cambió. */
export function dirCls(d) {
  const v = typeof d === 'number' ? d : d?.abs
  return v > 0 ? 'gain' : v < 0 ? 'loss' : ''
}

/** Elige la mejor variante por defecto (la que tenga precio de mercado). */
export function defaultVariant(variants) {
  const keys = Object.keys(variants || {})
  if (!keys.length) return null
  const withMarket = keys.find((k) => variants[k]?.market != null)
  return withMarket || keys[0]
}

/* ── Historial de precios ────────────────────────────────────────────────
 * Cada carta guarda `hist`: [[día, precio], …], con el día como entero de
 * días desde 1970 (ocupa poco en Firestore). Se agrega un punto cuando el
 * precio cambia o cuando pasaron HIST_REPEAT_DAYS del último aunque no haya
 * cambiado (así la curva no queda "colgada"); como mucho HIST_MAX puntos.
 */
export const HIST_MAX = 200
const HIST_REPEAT_DAYS = 7
const DAY_MS = 86400000

export const dayOf = (iso) => Math.floor(Date.parse(iso) / DAY_MS)
export const today = () => Math.floor(Date.now() / DAY_MS)

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "24 sep" o, con `long`, "24 sep 2026". El día se calcula en UTC, así que se lee en UTC. */
export function fmtDay(day, long = false) {
  const d = new Date(day * DAY_MS)
  const base = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
  return long ? `${base} ${d.getUTCFullYear()}` : base
}

/** Devuelve el historial con `price` registrado en la fecha `iso`. No muta. */
export function recordPrice(hist, price, iso) {
  const out = (hist || []).slice()
  if (price == null) return out
  const day = dayOf(iso)
  const last = out[out.length - 1]
  if (last && last[0] >= day) out[out.length - 1] = [last[0], price] // mismo día: se pisa
  else if (last && last[1] === price && day - last[0] < HIST_REPEAT_DAYS) return out
  else out.push([day, price])
  return out.length > HIST_MAX ? out.slice(out.length - HIST_MAX) : out
}

/** Historial de una carta. Las de antes del historial arrancan con su último precio conocido. */
export function histOf(item) {
  if (item.hist?.length) return item.hist
  if (item.mkt != null && item.mktAt) return [[dayOf(item.mktAt), item.mkt]]
  return []
}

/** Precio actual, pagado y variación (contra lo pagado y contra el primer registro). */
export function priceStats(item) {
  const hist = histOf(item)
  const first = hist[0]
  const now = item.mkt ?? hist[hist.length - 1]?.[1] ?? null
  const paid = item.paid ?? null
  const delta = (from) => (now != null && from != null ? { abs: now - from, pct: from ? (now - from) / from : null } : null)
  return {
    hist,
    now,
    paid,
    vsPaid: delta(paid),
    vsFirst: first ? { ...delta(first[1]), since: first[0] } : null,
  }
}

/** "+$0.63 (+42%)" — variación con signo. */
export function fmtDelta(d) {
  if (!d) return '—'
  const sign = d.abs >= 0 ? '+' : ''
  const pct = d.pct == null ? '' : ` (${sign}${Math.round(d.pct * 100)}%)`
  return `${sign}${fmtMoney(d.abs)}${pct}`
}

/**
 * Serie diaria de la colección desde el primer día con datos hasta hoy:
 * valor de mercado (último precio conocido de cada carta × cantidad) e
 * invertido (precio pagado × cantidad, desde el día en que se agregó).
 */
export function collectionSeries(items, until = today()) {
  const cards = items
    .map((it) => ({
      hist: histOf(it),
      qty: it.qty || 1,
      paid: it.paid ?? null,
      added: it.addedAt ? dayOf(it.addedAt) : null,
    }))
    .filter((c) => c.hist.length || c.paid != null)
  let start = Infinity
  for (const c of cards) {
    if (c.hist.length) start = Math.min(start, c.hist[0][0])
    if (c.paid != null && c.added != null) start = Math.min(start, c.added)
  }
  if (start === Infinity || start > until) return []
  const out = []
  const at = cards.map(() => -1) // índice del último punto ya aplicado, por carta
  for (let day = start; day <= until; day++) {
    let value = 0
    let invested = 0
    cards.forEach((c, i) => {
      while (at[i] + 1 < c.hist.length && c.hist[at[i] + 1][0] <= day) at[i]++
      if (at[i] >= 0) value += c.hist[at[i]][1] * c.qty
      if (c.paid != null && (c.added == null || c.added <= day)) invested += c.paid * c.qty
    })
    out.push({ day, value: Math.round(value * 100) / 100, invested: Math.round(invested * 100) / 100 })
  }
  return out
}
