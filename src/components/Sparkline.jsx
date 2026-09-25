/**
 * Mini gráfico del historial de precios de una carta, para la tabla.
 * Hereda el color del texto (currentColor): la celda lo pinta verde o rojo
 * según haya subido o bajado. El eje X es el tiempo real (días), así un
 * salto reciente se ve reciente. Con un solo punto dibuja una línea plana.
 */
const W = 72
const H = 22
const PAD = 3

export default function Sparkline({ hist, width = W, height = H }) {
  if (!hist?.length) return null
  const x0 = hist[0][0]
  const x1 = hist[hist.length - 1][0]
  const ys = hist.map((p) => p[1])
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const sx = (d) => (x1 === x0 ? width / 2 : PAD + ((d - x0) / (x1 - x0)) * (width - PAD * 2))
  const sy = (v) => (y1 === y0 ? height / 2 : height - PAD - ((v - y0) / (y1 - y0)) * (height - PAD * 2))
  const pts = hist.length === 1 ? [[PAD, height / 2], [width - PAD, height / 2]] : hist.map(([d, v]) => [sx(d), sy(v)])
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [ex, ey] = pts[pts.length - 1]
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="2.5" fill="currentColor" />
    </svg>
  )
}
