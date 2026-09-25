import { useMemo } from 'react'
import LineChart from './LineChart.jsx'
import { GAME_LABEL, fmtMoney, fmtDay, fmtDelta, totals, priceStats, collectionSeries, variantLabel, dirCls } from '../lib/helpers.js'

const COLOR = { value: 'var(--chart-1)', invested: 'var(--chart-2)' }
const fmtX = (day, long) => fmtDay(day, long)

/** Valor de la fila, para ordenar igual que la tabla (mayor valor primero). */
const rowValue = (it) => (it.mkt ?? -1) * (it.qty || 1)

/**
 * Pestaña de evolución de precios: la colección entera (valor de mercado vs
 * invertido, día a día) y una carta a elección (precio de mercado contra lo
 * que pagaste). Recibe los items ya acotados a un juego.
 */
export default function PriceHistory({ items, game, focus, onFocus }) {
  const sorted = useMemo(() => [...items].sort((a, b) => rowValue(b) - rowValue(a)), [items])
  const card = items.find((it) => it.uid === focus) || sorted[0] || null
  const series = useMemo(() => collectionSeries(items), [items])
  const t = totals(items)

  // las que más se movieron desde la compra (o desde el primer registro si no hay precio pagado)
  const movers = useMemo(
    () =>
      items
        .map((it) => {
          const s = priceStats(it)
          const d = s.vsFirst?.pct != null ? s.vsFirst : null
          return d && d.abs !== 0 ? { it, d } : null
        })
        .filter(Boolean)
        .sort((a, b) => Math.abs(b.d.pct) - Math.abs(a.d.pct))
        .slice(0, 6),
    [items]
  )

  if (!items.length) {
    return (
      <div className="empty">
        <p>Todavía no hay cartas de {GAME_LABEL[game]} para graficar.</p>
      </div>
    )
  }

  const hasInvested = series.some((d) => d.invested > 0)
  const collectionSeriesData = [
    { id: 'value', label: 'Valor de mercado', color: COLOR.value, points: series.map((d) => ({ x: d.day, y: d.value })) },
    ...(hasInvested
      ? [{ id: 'invested', label: 'Invertido', color: COLOR.invested, points: series.map((d) => ({ x: d.day, y: d.invested })) }]
      : []),
  ]
  const stats = card ? priceStats(card) : null

  return (
    <div className="history">
      <section>
        <h3>Tu colección de {GAME_LABEL[game]}</h3>
        <p className="hint">
          Valor de mercado de todas las cartas, día a día, contra lo que invertiste. Cada actualización diaria de precios agrega un
          punto{series.length <= 1 ? ': el historial arranca hoy, en unos días vas a ver la curva' : ''}.
        </p>
        <div className="tiles">
          <Tile label="Valor de mercado" value={fmtMoney(t.value)} />
          <Tile
            label="Desde que las agregaste"
            value={t.initial ? fmtDelta({ abs: t.change, pct: t.change / t.initial }) : '—'}
            cls={dirCls(t.change)}
          />
          {t.invested > 0 && (
            <>
              <Tile label="Invertido" value={fmtMoney(t.invested)} />
              <Tile label="G/P vs pagado" value={fmtDelta({ abs: t.pl, pct: t.pl / t.invested })} cls={dirCls(t.pl)} />
            </>
          )}
        </div>
        {collectionSeriesData.length > 1 && (
          <div className="legend">
            {collectionSeriesData.map((s) => (
              <span key={s.id}>
                <i className="chart-key" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        )}
        <LineChart series={collectionSeriesData} fmtX={fmtX} fmtY={fmtMoney} ariaLabel="Valor de la colección a lo largo del tiempo" />
      </section>

      <section>
        <h3>Por carta</h3>
        <div className="row">
          <select value={card?.uid || ''} onChange={(e) => onFocus(e.target.value)} aria-label="Carta">
            {sorted.map((it) => (
              <option key={it.uid} value={it.uid}>
                {it.name} · {it.set}
                {it.num ? ` · ${it.num}` : ''}
                {it.variant ? ` · ${variantLabel(it.variant)}` : ''}
              </option>
            ))}
          </select>
        </div>

        {card && stats && (
          <>
            <div className="hist-card">
              {card.img && <img src={card.img} alt="" />}
              <div>
                <strong>{card.name}</strong>
                <div className="cc-meta">
                  {card.set}
                  {card.num ? ` · ${card.num}` : ''}
                  {card.variant ? ` · ${variantLabel(card.variant)}` : ''}
                  {card.cond ? ` · ${card.cond}` : ''}
                  {card.qty > 1 ? ` · ×${card.qty}` : ''}
                </div>
              </div>
            </div>
            <div className="tiles">
              <Tile
                label={stats.vsFirst ? `Al agregarla (${fmtDay(stats.vsFirst.since)})` : 'Al agregarla'}
                value={stats.hist.length ? fmtMoney(stats.hist[0][1]) : '—'}
              />
              <Tile label="Mercado hoy (u.)" value={fmtMoney(stats.now)} />
              <Tile label="Desde que la agregaste" value={fmtDelta(stats.vsFirst)} cls={dirCls(stats.vsFirst)} />
              {stats.paid != null && (
                <>
                  <Tile label="Pagaste (u.)" value={fmtMoney(stats.paid)} />
                  <Tile label="Vs pagado" value={fmtDelta(stats.vsPaid)} cls={dirCls(stats.vsPaid)} />
                </>
              )}
            </div>
            {stats.hist.length ? (
              <LineChart
                series={[{ id: 'mkt', label: 'Precio de mercado', color: COLOR.value, points: stats.hist.map(([d, p]) => ({ x: d, y: p })) }]}
                refLines={
                  stats.paid != null
                    ? [{ y: stats.paid, label: `Pagaste ${fmtMoney(stats.paid)}` }]
                    : [{ y: stats.hist[0][1], label: `Al agregarla ${fmtMoney(stats.hist[0][1])}` }]
                }
                fmtX={fmtX}
                fmtY={fmtMoney}
                ariaLabel={`Precio de mercado de ${card.name} a lo largo del tiempo`}
              />
            ) : (
              <p className="hint">Esta carta no tiene precio de mercado registrado todavía.</p>
            )}
            {stats.hist.length === 1 && (
              <p className="hint">Un solo punto por ahora: la curva se arma con las actualizaciones diarias de precios.</p>
            )}
          </>
        )}
      </section>

      {movers.length > 0 && (
        <section>
          <h3>Las que más se movieron</h3>
          <ul className="movers">
            {movers.map(({ it, d }) => (
              <li key={it.uid}>
                <button type="button" className={it.uid === card?.uid ? 'on' : ''} onClick={() => onFocus(it.uid)}>
                  <span>
                    {it.name}
                    <small>
                      {' '}
                      · {it.set}
                      {it.num ? ` · ${it.num}` : ''}
                    </small>
                  </span>
                  <b className={dirCls(d)}>{fmtDelta(d)}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Tile({ label, value, cls = '' }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={cls}>{value}</strong>
    </div>
  )
}
