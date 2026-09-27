import { useRef, useState } from 'react'
import { search } from '../lib/search.js'
import { getByProductId } from '../api/tcgcsv.js'
import CardModal from './CardModal.jsx'
import { GAME_LABEL, variantLabel, defaultVariant, fmtMoney, CONDITIONS, recordPrice } from '../lib/helpers.js'
import { newUid } from '../lib/storage.js'

/** Alta de cartas acotada a un juego: lo que sea del otro no se puede agregar acá. */
export default function AddCard({ onAdd, game }) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState(null) // resultado elegido (puede venir sin precios)
  const [card, setCard] = useState(null) // el elegido, con precios
  const [loadingCard, setLoadingCard] = useState(false)
  const [preview, setPreview] = useState(null) // posición (en `previewList`) de la carta abierta en grande
  const pickSeq = useRef(0) // descarta respuestas de elecciones viejas

  const other = game === 'pk' ? 'op' : 'pk'
  // con varios resultados, el modal los recorre; con uno solo, muestra el elegido
  const previewList = results && results.length > 1 ? results : card ? [card] : []

  /** Los resultados del índice local no traen precios: se completan al elegir. */
  async function pick(r) {
    const seq = ++pickSeq.current
    setSelected(r)
    if (r.variants) {
      setCard(r)
      return
    }
    setCard(null)
    setLoadingCard(true)
    try {
      const full = await getByProductId(r.sourceId)
      if (seq !== pickSeq.current) return
      setCard(full || { ...r, variants: {} })
    } finally {
      if (seq === pickSeq.current) setLoadingCard(false)
    }
  }

  async function runSearch(e) {
    e?.preventDefault()
    if (!query.trim() || busy) return
    setBusy(true)
    setSelected(null)
    setCard(null)
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
      if (mine.length === 1) await pick(mine[0])
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
          placeholder={
            game === 'op'
              ? 'Pegá la URL de TCGPlayer, un código (OP01-001) o un nombre…'
              : 'Pegá la URL de TCGPlayer, el número (125/182, PAR 125) o un nombre…'
          }
          autoFocus
        />
        <button className="btn primary" disabled={busy || !query.trim()}>
          {busy ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      <p className="hint">
        Agregando a <b>{GAME_LABEL[game]}</b>. Ejemplos: <code>https://www.tcgplayer.com/product/543603/…</code> ·{' '}
        {game === 'op' ? (
          <>
            <code>OP01-121</code> · <code>zoro</code>
          </>
        ) : (
          <>
            <code>125/182</code> · <code>PAR 125</code> · <code>125</code> (todas las cartas con ese número) · <code>charizard</code>
          </>
        )}
      </p>

      {note && <p className="note">{note}</p>}

      {results && results.length > 1 && (
        <div className="results-grid">
          {results.map((r) => (
            <button
              key={`${r.source}-${r.sourceId}`}
              className={`result-card ${selected?.sourceId === r.sourceId && selected?.source === r.source ? 'sel' : ''}`}
              onClick={() => pick(r)}
              type="button"
            >
              <Thumb src={r.img} alt={r.name} />
              <div className="rc-name">{r.name}</div>
              <div className="rc-meta">
                {GAME_LABEL[r.game]} · {r.set}
                {r.num ? ` · ${r.num}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {loadingCard && <p className="hint">Cargando precios…</p>}
      {card && (
        <AddForm
          key={`${card.source}-${card.sourceId}`}
          card={card}
          onAdd={onAdd}
          onPreview={() => setPreview(Math.max(0, previewList.findIndex((r) => r.sourceId === card.sourceId)))}
        />
      )}

      {preview != null && (
        <CardModal cards={previewList} index={preview} onIndexChange={setPreview} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}

/** Imagen de carta con relleno si no hay o si el CDN no la tiene. */
function Thumb({ src, alt, big = false }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <div className={`noimg ${big ? 'big' : ''}`}>Sin imagen</div>
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />
}

function AddForm({ card, onAdd, onPreview }) {
  const variants = Object.keys(card.variants || {})
  const [variant, setVariant] = useState(defaultVariant(card.variants))
  const [qty, setQty] = useState(1)
  const [cond, setCond] = useState('NM')
  const market = variant ? card.variants[variant]?.market : null
  const [paid, setPaid] = useState('')

  function submit(e) {
    e.preventDefault()
    const now = new Date().toISOString()
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
      paid: paid === '' || Number.isNaN(Number(paid)) ? null : Math.max(0, Number(paid)),
      mkt: market ?? null,
      mktAt: market != null ? now : null,
      hist: recordPrice([], market, now), // el historial de precios arranca hoy
      addedAt: now,
    })
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="af-card">
        <button type="button" className="thumb-btn" onClick={() => onPreview(card)} title="Ver en grande">
          <Thumb src={card.img} alt={card.name} big />
        </button>
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
