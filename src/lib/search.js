/**
 * Orquestador de búsqueda: interpreta la entrada (URL / código / nombre)
 * y consulta la fuente que corresponda.
 */

import { parseInput } from './parse.js'
import { getByProductId, getOpByCode, searchOpByName } from '../api/tcgcsv.js'
import { getCardById, searchByName } from '../api/pokemontcg.js'

/**
 * @param {string} raw  lo que pegó el usuario
 * @param {'all'|'pk'|'op'} game  filtro de juego para búsquedas por nombre
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

    case 'opcode': {
      const results = await getOpByCode(parsed.code)
      return results.length
        ? { results }
        : { results: [], note: `No encontré el código ${parsed.code}. Verificá el formato (ej: OP01-001, ST13-003).` }
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

async function nameSearch(q, game) {
  const jobs = []
  if (game !== 'op') jobs.push(searchByName(q).catch(() => []))
  if (game !== 'pk') jobs.push(searchOpByName(q).catch(() => []))
  const settled = await Promise.all(jobs)
  const results = settled.flat()
  return {
    results,
    note: results.length ? undefined : 'Sin resultados. Probá con el nombre en inglés, el código de la carta o la URL de TCGPlayer.',
  }
}
