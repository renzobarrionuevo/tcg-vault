/**
 * Interpreta lo que el usuario pega en el buscador:
 *  - URL de tcgplayer.com  → productId
 *  - productId numérico    → productId
 *  - código One Piece      → OP01-001, ST13-003, EB01-006, PRB01-001, P-001…
 *  - código Pokémon        → sv4-123, base1-4, swsh12pt5gg-GG44 (id de pokemontcg.io)
 *  - cualquier otra cosa   → búsqueda por nombre
 */

const TCGPLAYER_URL_RE = /tcgplayer\.com\/product\/(\d+)/i
const PRODUCT_ID_RE = /^\d{4,8}$/
const OP_CODE_RE = /^(OP|ST|EB|PRB|P)(\d*)-(\d+)$/i
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

  // código estilo pokemontcg.io: "sv4-123" (set en minúscula, número tal cual)
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
