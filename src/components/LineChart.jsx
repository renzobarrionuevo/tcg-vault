import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Gráfico de líneas en SVG, sin librerías.
 *
 *  series:   [{ id, label, color, points: [{ x, y }] }]  — x es un día entero
 *  refLines: [{ y, label }]  líneas de referencia (ej: lo que pagaste)
 *  fmtX(x, long) / fmtY(y): formateadores para ejes y tooltip
 *
 * Trae lo que un gráfico debe traer: grilla fina, puntos con anillo del color
 * del fondo, valor al final de cada línea, crosshair con tooltip (también con
 * teclado: ← →) y una tabla desplegable con los mismos datos.
 */

const M = { top: 14, right: 78, bottom: 28, left: 56 }

function niceStep(span, target) {
  const raw = span / target
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p
}

function ticksFor(min, max, target, minStep = 0) {
  if (!(max > min)) return [min]
  const step = Math.max(minStep, niceStep(max - min, target))
  const out = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10))
  return out
}

/** ancho real del contenedor, para que el SVG se dibuje a escala 1:1 */
function useWidth(ref, fallback = 600) {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** último punto de la serie en o antes de x (la línea "vale" eso hasta el siguiente punto) */
function valueAt(points, xv) {
  let found = null
  for (const p of points) {
    if (p.x > xv) break
    found = p
  }
  return found
}

export default function LineChart({ series, refLines = [], fmtX, fmtY, height = 220, ariaLabel = '' }) {
  const box = useRef(null)
  const width = useWidth(box)
  const [hover, setHover] = useState(null) // índice en xs

  const xs = useMemo(
    () => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b),
    [series]
  )

  const iw = width - M.left - M.right
  const ih = height - M.top - M.bottom
  const base = M.top + ih

  const { x, y, yTicks, xTicks } = useMemo(() => {
    let x0 = xs[0] ?? 0
    let x1 = xs[xs.length - 1] ?? 0
    if (x1 === x0) {
      x0 -= 1
      x1 += 1
    }
    const ys = [...series.flatMap((s) => s.points.map((p) => p.y)), ...refLines.map((r) => r.y)].filter((v) => v != null)
    let y0 = ys.length ? Math.min(...ys) : 0
    let y1 = ys.length ? Math.max(...ys) : 1
    if (y1 === y0) {
      y0 *= 0.9
      y1 = y1 * 1.1 || 1
    }
    const pad = (y1 - y0) * 0.12
    y0 = Math.max(0, y0 - pad)
    y1 += pad
    const x = (v) => M.left + ((v - x0) / (x1 - x0)) * iw
    const y = (v) => M.top + ih - ((v - y0) / (y1 - y0)) * ih
    return {
      x,
      y,
      yTicks: ticksFor(y0, y1, 4),
      xTicks: ticksFor(x0, x1, Math.max(2, Math.min(6, Math.floor(iw / 90))), 1).filter((t) => t >= x0 && t <= x1), // días enteros
    }
  }, [xs, series, refLines, iw, ih])

  function pick(clientX, svg) {
    const px = clientX - svg.getBoundingClientRect().left
    let best = 0
    let dist = Infinity
    xs.forEach((v, i) => {
      const d = Math.abs(x(v) - px)
      if (d < dist) {
        dist = d
        best = i
      }
    })
    setHover(best)
  }

  function onKey(e) {
    if (!xs.length) return
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? xs.length) - 1))
    else if (e.key === 'ArrowRight') setHover((h) => Math.min(xs.length - 1, (h ?? -1) + 1))
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const linePath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ')
  const areaPath = (pts) =>
    pts.length > 1 ? `${linePath(pts)} L${x(pts[pts.length - 1].x).toFixed(1)} ${base} L${x(pts[0].x).toFixed(1)} ${base} Z` : ''

  // valor al final de cada línea; si dos quedan encimados se omiten (la leyenda y el tooltip los cubren)
  const ends = series.map((s) => s.points[s.points.length - 1]).filter(Boolean)
  const endsCollide = ends.length > 1 && Math.abs(y(ends[0].y) - y(ends[1].y)) < 14

  const hx = hover != null ? xs[hover] : null
  const hoverRows = hx != null ? series.map((s) => ({ s, p: valueAt(s.points, hx) })).filter((r) => r.p) : []
  const tipLeft = hx != null ? (x(hx) > width - 170 ? x(hx) - 160 : x(hx) + 12) : 0

  return (
    <div className="chart" ref={box}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {yTicks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
            <text className="chart-tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {fmtY(t)}
            </text>
          </g>
        ))}
        <line className="chart-axis" x1={M.left} x2={width - M.right} y1={base} y2={base} />
        {xTicks.map((t) => (
          <text key={t} className="chart-tick" x={x(t)} y={height - 8} textAnchor="middle">
            {fmtX(t)}
          </text>
        ))}

        {refLines.map((r) => (
          <g key={r.label}>
            <line className="chart-ref" x1={M.left} x2={width - M.right} y1={y(r.y)} y2={y(r.y)} />
            <text className="chart-ref-label" x={M.left + 4} y={y(r.y) - 5}>
              {r.label}
            </text>
          </g>
        ))}

        {series.map((s) => (
          <g key={s.id}>
            {series.length === 1 && <path d={areaPath(s.points)} fill={s.color} opacity="0.1" />}
            <path d={linePath(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {(s.points.length <= 40 ? s.points : s.points.slice(-1)).map((p) => (
              <circle key={p.x} cx={x(p.x)} cy={y(p.y)} r="4" fill={s.color} className="chart-dot" />
            ))}
          </g>
        ))}

        {!endsCollide &&
          series.map((s) => {
            const p = s.points[s.points.length - 1]
            return p ? (
              <text key={s.id} className="chart-end" x={x(p.x) + 9} y={y(p.y)} dy="0.32em">
                {fmtY(p.y)}
              </text>
            ) : null
          })}

        {hx != null && (
          <g>
            <line className="chart-cross" x1={x(hx)} x2={x(hx)} y1={M.top} y2={base} />
            {hoverRows.map(({ s, p }) => (
              <circle key={s.id} cx={x(hx)} cy={y(p.y)} r="5" fill={s.color} className="chart-dot" />
            ))}
          </g>
        )}

        {/* capa de interacción: toda el área del gráfico es blanco del puntero */}
        <rect
          className="chart-overlay"
          x={M.left}
          y={M.top}
          width={Math.max(0, iw)}
          height={Math.max(0, ih)}
          fill="transparent"
          tabIndex={0}
          aria-label="Explorar valores (← →)"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.ownerSVGElement)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        />
      </svg>

      {hx != null && (
        <div className="chart-tip" style={{ left: tipLeft, top: M.top }}>
          <strong>{fmtX(hx, true)}</strong>
          {hoverRows.map(({ s, p }) => (
            <div key={s.id} className="chart-tip-row">
              <i className="chart-key" style={{ background: s.color }} />
              <b>{fmtY(p.y)}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <details className="chart-table">
        <summary>Ver como tabla</summary>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              {series.map((s) => (
                <th key={s.id} className="num">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xs.map((xv) => (
              <tr key={xv}>
                <td>{fmtX(xv, true)}</td>
                {series.map((s) => {
                  const p = s.points.find((q) => q.x === xv)
                  return (
                    <td key={s.id} className="num">
                      {p ? fmtY(p.y) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
