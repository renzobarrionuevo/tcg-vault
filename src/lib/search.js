/**
 * Orquestador de búsqueda: interpreta la entrada (URL / código / número /
 * nombre) y consulta la fuente que corresponda.
 *
 * Los resultados pueden venir "livianos" (sin `variants`, o sea sin precios)
 * cuando salen de los índices locales; AddCard los completa al elegir uno.
 */

import { parseInput } from './parse.js'
import { getByProductId, getOpByCode, searchByName, searchByNumber, hasIndex } from '../api/tcgcsv.js'
import { getCardById, searchByName as searchPtcgByName } from '../api/pokemontcg.js'

const NO_NUMBER = (what) =>
  `No encontré cartas con el número ${what}. Probá con el número tal como figura en la carta (125/182), con el set (PAR 125) o con el nombre.`

/**
 * @param {string} raw  lo que pegó el usuario
 * @param {'all'|'pk'|'op'} game  juego al que se está agregando
 * @returns {Promise<{results: Array, note?: string}>}
 */
export async function search(raw, game = 'all') {
  const parsed = parseInput(raw)

  switch (parsed.type) {
    case 'empty':
      return { results: [] }

    case 'product': {
      const card = await getByProductId(parsed.productId)
      if (!card) {
        return {
          results: [],
          note: `No encontré el producto ${parsed.productId} en los datos de TCGPlayer. Si la carta salió hoy, esperá a la próxima actualización diaria de precios.`,
        }
      }
      return { results: [card] }
    }

    case 'opcode':
      return opCode(parsed.code)

    // "125/182": número exacto de Pokémon
    case 'pknum': {
      if (game === 'op') return nameSearch(raw, game)
      const results = await searchByNumber('pk', { num: parsed.num, total: parsed.total })
      return results.length ? { results } : { results: [], note: NO_NUMBER(`${parsed.num}/${parsed.total}`) }
    }

    // "PAR 125", "paradox 125", "sv4-123", "st13 3"
    case 'setnum': {
      if (game === 'op') {
        // en One Piece "st13 3" es el código ST13-003
        const code = parseInput(`${parsed.set}-${parsed.num}`)
        return code.type === 'opcode' ? opCode(code.code) : nameSearch(raw, game)
      }
      const results = await searchByNumber('pk', { num: parsed.num, total: parsed.total, set: parsed.set })
      if (results.length) return { results }
      // puede ser un id de pokemontcg.io ("sv4-123")
      try {
        const card = await getCardById(parsed.id)
        if (card) return { results: [card] }
      } catch {
        /* sin red o sin API: seguimos */
      }
      return { results: [], note: NO_NUMBER(`${parsed.num} en el set «${parsed.set}»`) }
    }

    // "125": todas las cartas con ese número
    case 'number': {
      if (game === 'op') return nameSearch(raw, game)
      const results = await searchByNumber('pk', { num: parsed.num })
      return results.length
        ? { results, note: results.length >= 30 ? `Mostrando las 30 más recientes con el número ${parsed.num}. Agregá el set para afinar (PAR ${parsed.num}).` : undefined }
        : { results: [], note: NO_NUMBER(String(parsed.num)) }
    }

    case 'pkcode': {
      try {
        const card = await getCardById(parsed.id)
        if (card) return { results: [card] }
      } catch {
        /* si la API falla, probamos como nombre */
      }
      return nameSearch(raw, game) // reintenta como nombre
    }

    case 'name':
    default:
      return nameSearch(parsed.q, game)
  }
}

async function opCode(code) {
  const results = await getOpByCode(code)
  return results.length
    ? { results }
    : { results: [], note: `No encontré el código ${code}. Verificá el formato (ej: OP01-001, ST13-003).` }
}

async function nameSearch(q, game) {
  const jobs = []
  if (game !== 'op') jobs.push(pkNameSearch(q))
  if (game !== 'pk') jobs.push(searchByName('op', q).catch(() => []))
  const settled = await Promise.all(jobs)
  const results = settled.flat()
  return {
    results,
    note: results.length ? undefined : 'Sin resultados. Probá con el nombre en inglés, el número de la carta o la URL de TCGPlayer.',
  }
}

/** Pokémon: índice local primero; pokemontcg.io solo si el índice no existe. */
async function pkNameSearch(q) {
  const local = await searchByName('pk', q).catch(() => [])
  if (local.length) return local
  if (await hasIndex('pk').catch(() => false)) return []
  return searchPtcgByName(q).catch(() => [])
}
