/**
 * Interpreta lo que el usuario pega en el buscador:
 *  - URL de tcgplayer.com  → productId
 *  - productId numérico    → productId (4 a 8 dígitos)
 *  - código One Piece      → OP01-001, ST13-003, EB01-006, PRB01-001, P-001…
 *  - número de carta       → 125/182  (Pokémon: número / total del set)
 *  - set + número          → PAR 125, par-125, paradox 125, sv4-123, PAR 125/182
 *                            (abreviatura o parte del nombre del set, y número;
 *                             "sv4-123" además sirve como id de pokemontcg.io)
 *  - código Pokémon        → swsh12pt5gg-GG44 (id de pokemontcg.io con letras)
 *  - solo un número        → 125 (1 a 3 dígitos: todas las cartas con ese número)
 *  - cualquier otra cosa   → búsqueda por nombre
 */

const TCGPLAYER_URL_RE = /tcgplayer\.com\/product\/(\d+)/i
const PRODUCT_ID_RE = /^\d{4,8}$/
const OP_CODE_RE = /^(OP|ST|EB|PRB|P)(\d*)-(\d+)$/i
const NUM_TOTAL_RE = /^(\d{1,3})\s*\/\s*(\d{1,3})$/
const SET_NUM_RE = /^([a-z][a-z0-9.&'-]{0,14}?)[\s-]+(\d{1,3})(?:\s*\/\s*(\d{1,3}))?$/i
const NUMBER_RE = /^\d{1,3}$/
const PK_CODE_RE = /^([a-z][a-z0-9.]*?)-([0-9a-zA-Z]+)$/i

export function parseInput(raw) {
  const s = (raw || '').trim()
  if (!s) return { type: 'empty' }

  const url = s.match(TCGPLAYER_URL_RE)
  if (url) return { type: 'product', productId: Number(url[1]) }

  if (PRODUCT_ID_RE.test(s)) return { type: 'product', productId: Number(s) }

  const op = s.replace(/\s+/g, '').match(OP_CODE_RE)
  if (op) {
    const [, prefix, setNum, cardNum] = op
    // normaliza: op1-1 → OP01-001 (P-001 mantiene su forma)
    const code =
      prefix.toUpperCase() === 'P' && !setNum
        ? `P-${cardNum.padStart(3, '0')}`
        : `${prefix.toUpperCase()}${setNum.padStart(2, '0')}-${cardNum.padStart(3, '0')}`
    return { type: 'opcode', code }
  }

  const nt = s.match(NUM_TOTAL_RE)
  if (nt) return { type: 'pknum', num: Number(nt[1]), total: Number(nt[2]) }

  const sn = s.match(SET_NUM_RE)
  if (sn) {
    const [, set, num, total] = sn
    return {
      type: 'setnum',
      set: set.toLowerCase(),
      num: Number(num),
      total: total ? Number(total) : null,
      id: `${set.toLowerCase()}-${num}`, // por si es un id de pokemontcg.io ("sv4-123")
    }
  }

  if (NUMBER_RE.test(s)) return { type: 'number', num: Number(s) }

  // id de pokemontcg.io con letras en el número: "swsh12pt5gg-GG44"
  const pk = s.replace(/\s+/g, '').match(PK_CODE_RE)
  if (pk && /\d/.test(pk[1] + pk[2])) {
    return { type: 'pkcode', id: `${pk[1].toLowerCase()}-${pk[2]}` }
  }

  return { type: 'name', q: s }
}

/** "OP01-001" → true si parece código de One Piece */
export function looksLikeOpCode(s) {
  return OP_CODE_RE.test((s || '').trim().replace(/\s+/g, ''))
}
