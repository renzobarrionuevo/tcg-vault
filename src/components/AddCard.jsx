import { useState } from 'react'
import { search } from '../lib/search.js'
import { GAME_LABEL, variantLabel, defaultVariant, fmtMoney, CONDITIONS } from '../lib/helpers.js'
import { newUid } from '../lib/storage.js'

/** Alta de cartas acotada a un juego: lo que sea del otro no se puede agregar acá. */
export default function AddCard({ onAdd, game }) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState(null)

  const other = game === 'pk' ? 'op' : 'pk'

  async function runSearch(e) {
    e?.preventDefault()
    if (!query.trim() || busy) return
    setBusy(true)
    setSelected(null)
    setNote('')
    try {
      const res = await search(query, game)
      // la búsqueda por URL/código puede traer una carta del otro juego: se descarta
      const mine = res.results.filter((r) => r.game === game)
      const descartadas = res.results.length - mine.length
      setResults(mine)
      setNote(
        !mine.length && descartadas
          ? `Esa carta es de ${GAME_LABEL[other]}. Volvé a «Juegos» y entrá a la colección de ${GAME_LABEL[other]} para agregarla.`
          : res.note || ''
      )
      if (mine.length === 1) setSelected(mine[0])
    } catch (err) {
      setResults([])
      setNote(`Error buscando: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="add-card">
      <form className="search-row" onSubmit={runSearch}>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Pegá la URL de TCGPlayer, un código (${game === 'op' ? 'OP01-001' : 'sv4-123'}) o un nombre…`}
          autoFocus
        />
        <button className="btn primary" disabled={busy || !query.trim()}>
          {busy ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      <p className="hint">
        Agregando a <b>{GAME_LABEL[game]}</b>. Ejemplos: <code>https://www.tcgplayer.com/product/543603/…</code> ·{' '}
        <code>{game === 'op' ? 'OP01-121' : 'sv4-182'}</code> · <code>{game === 'op' ? 'zoro' : 'charizard'}</code>
      </p>

      {note && <p className="note">{note}</p>}

      {results && results.length > 1 && (
        <div className="results-grid">
          {results.map((r) => (
            <button
              key={`${r.source}-${r.sourceId}`}
              className={`result-card ${selected?.sourceId === r.sourceId && selected?.source === r.source ? 'sel' : ''}`}
              onClick={() => setSelected(r)}
              type="button"
            >
              {r.img ? <img src={r.img} alt={r.name} loading="lazy" /> : <div className="noimg">Sin imagen</div>}
              <div className="rc-name">{r.name}</div>
              <div className="rc-meta">
                {GAME_LABEL[r.game]} · {r.set}
                {r.num ? ` · ${r.num}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <AddForm key={`${selected.source}-${selected.sourceId}`} card={selected} onAdd={onAdd} />}
    </div>
  )
}

function AddForm({ card, onAdd }) {
  const variants = Object.keys(card.variants || {})
  const [variant, setVariant] = useState(defaultVariant(card.variants))
  const [qty, setQty] = useState(1)
  const [cond, setCond] = useState('NM')
  const market = variant ? card.variants[variant]?.market : null
  const [paid, setPaid] = useState('')

  function submit(e) {
    e.preventDefault()
    onAdd({
      uid: newUid(),
      source: card.source,
      sourceId: card.sourceId,
      game: card.game,
      name: card.name,
      set: card.set,
      num: card.num,
      rarity: card.rarity,
      img: card.img,
      url: card.url,
      variant,
      qty: Math.max(1, Number(qty) || 1),
      cond,
      paid: paid === '' ? null : Math.max(0, Number(paid)),
      mkt: market ?? null,
      mktAt: market != null ? new Date().toISOString() : null,
      addedAt: new Date().toISOString(),
    })
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="af-card">
        {card.img ? <img src={card.img} alt={card.name} /> : <div className="noimg big">Sin imagen</div>}
        <div>
          <h3>{card.name}</h3>
          <p className="rc-meta">
            {GAME_LABEL[card.game]} · {card.set}
            {card.num ? ` · ${card.num}` : ''}
            {card.rarity ? ` · ${card.rarity}` : ''}
          </p>
          {card.url && (
            <a href={card.url} target="_blank" rel="noreferrer" className="ext-link">
              Ver en TCGPlayer ↗
            </a>
          )}
        </div>
      </div>

      <div className="af-fields">
        <label>
          Variante
          <select value={variant || ''} onChange={(e) => setVariant(e.target.value)}>
            {variants.length === 0 && <option value="">(sin datos de precio)</option>}
            {variants.map((v) => (
              <option key={v} value={v}>
                {variantLabel(v)} {card.variants[v]?.market != null ? `— ${fmtMoney(card.variants[v].market)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cantidad
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <label>
          Condición
          <select value={cond} onChange={(e) => setCond(e.target.value)}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Pagaste (u.)
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={market != null ? String(market) : '0.00'}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
        </label>
        <div className="af-market">
          <span>Mercado</span>
          <strong>{fmtMoney(market)}</strong>
        </div>
        <button className="btn primary" type="submit">
          Agregar a la colección
        </button>
      </div>
    </form>
  )
}
