import { useMemo, useState } from 'react'
import RarityBar from './RarityBar.jsx'
import CardModal from './CardModal.jsx'
import { GAME_LABEL, variantLabel, fmtMoney, fmtDate, CONDITIONS, marketOf } from '../lib/helpers.js'

/** Órdenes disponibles; el primero es el que se usa al entrar. */
const SORTS = {
  value: { label: 'Mayor valor', fn: (a, b) => valueOf(b) - valueOf(a) },
  pl: { label: 'Mayor ganancia', fn: (a, b) => plOf(b) - plOf(a) },
  added: { label: 'Más recientes', fn: (a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') },
  name: { label: 'Nombre', fn: (a, b) => (a.name || '').localeCompare(b.name || '') },
}
const DEFAULT_SORT = Object.keys(SORTS)[0]

/** Valor total de la fila (precio × cantidad); sin precio va al final. */
function valueOf(it) {
  const m = marketOf(it)
  return m == null ? -Infinity : m * (it.qty || 1)
}

function plOf(it) {
  const m = marketOf(it)
  if (m == null || it.paid == null) return -Infinity
  return (m - it.paid) * (it.qty || 1)
}

/** Recibe los items ya acotados a un juego (App decide cuál). */
export default function CollectionTable({ items, game, onUpdate, onRemove }) {
  const [text, setText] = useState('')
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [preview, setPreview] = useState(null) // posición (en `filtered`) de la carta abierta en grande

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase()
    return items
      .filter((it) =>
        !needle
          ? true
          : [it.name, it.set, it.num, it.rarity].filter(Boolean).some((f) => String(f).toLowerCase().includes(needle))
      )
      .sort(SORTS[sort].fn)
  }, [items, text, sort])

  if (!items.length) {
    return (
      <div className="empty">
        <p>Todavía no registraste ninguna carta de {GAME_LABEL[game]}.</p>
        <p className="hint">
          Andá a «Agregar» y pegá una URL de TCGPlayer o un código como{' '}
          {game === 'op' ? 'OP01-001' : 'sv4-182'}.
        </p>
      </div>
    )
  }

  return (
    <div>
      <RarityBar items={items} game={game} />

      <div className="filters">
        <input placeholder="Filtrar por nombre, set, código…" value={text} onChange={(e) => setText(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <span className="count">
          {filtered.length} de {items.length}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Carta</th>
              <th>Variante</th>
              <th>Cond.</th>
              <th className="num">Cant.</th>
              <th className="num">Pagado (u.)</th>
              <th className="num">Mercado (u.)</th>
              <th className="num">Valor</th>
              <th className="num">G/P</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, i) => {
              const m = marketOf(it)
              const qty = it.qty || 1
              const value = m != null ? m * qty : null
              const pl = m != null && it.paid != null ? (m - it.paid) * qty : null
              return (
                <tr key={it.uid}>
                  <td>
                    <div className="cell-card">
                      <button type="button" className="thumb-btn" onClick={() => setPreview(i)} title="Ver en grande">
                        {it.img ? <img src={it.img} alt="" loading="lazy" /> : <div className="noimg mini" />}
                      </button>
                      <div>
                        <div className="cc-name">
                          {it.url ? (
                            <a href={it.url} target="_blank" rel="noreferrer">
                              {it.name}
                            </a>
                          ) : (
                            it.name
                          )}
                        </div>
                        <div className="cc-meta">
                          {it.set}
                          {it.num ? ` · ${it.num}` : ''}
                          {it.rarity ? ` · ${it.rarity}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{variantLabel(it.variant) || '—'}</td>
                  <td>
                    <select value={it.cond || 'NM'} onChange={(e) => onUpdate(it.uid, { cond: e.target.value })}>
                      {CONDITIONS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      className="qty"
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => onUpdate(it.uid, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="paid"
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.paid ?? ''}
                      placeholder="—"
                      onChange={(e) => onUpdate(it.uid, { paid: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                    />
                  </td>
                  <td className="num" title={it.mktAt ? `Actualizado: ${fmtDate(it.mktAt)}` : ''}>
                    {fmtMoney(m)}
                  </td>
                  <td className="num">{fmtMoney(value)}</td>
                  <td className={`num ${pl == null ? '' : pl >= 0 ? 'gain' : 'loss'}`}>
                    {pl == null ? '—' : `${pl >= 0 ? '+' : ''}${fmtMoney(pl)}`}
                  </td>
                  <td>
                    <button
                      className="btn ghost danger"
                      title="Eliminar"
                      onClick={() => confirm(`¿Eliminar "${it.name}" de la colección?`) && onRemove(it.uid)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {preview != null && (
        <CardModal cards={filtered} index={preview} onIndexChange={setPreview} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}
