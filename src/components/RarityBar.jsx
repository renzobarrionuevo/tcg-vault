import { rarityCounts, rarityMeta } from '../lib/helpers.js'

/**
 * Chips con la cantidad de cartas por rareza, de la más buscada a la menos.
 * Se calcula sobre la colección entera del juego, no sobre lo que filtró el
 * usuario, así el desglose no cambia mientras se busca.
 */
export default function RarityBar({ items, game }) {
  const rows = rarityCounts(items, game)
  if (!rows.length) return null

  return (
    <div className="rarity-bar">
      {rows.map(({ code, count }) => {
        const m = rarityMeta(game, code)
        return (
          <span key={code} className={`rchip ${m.cls}`} title={m.name}>
            {m.sym && <i className="rsym">{m.sym}</i>}
            <b>{m.label}</b>
            <span>{count}</span>
          </span>
        )
      })}
    </div>
  )
}
