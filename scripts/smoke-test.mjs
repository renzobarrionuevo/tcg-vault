/**
 * Smoke test E2E con Playwright contra el build de producción (vite preview).
 * Ejercita: alta por URL de TCGPlayer, alta por código OP, edición, totales,
 * persistencia en localStorage y actualización de precios.
 * (Solo para desarrollo; no forma parte del deploy.)
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:4173/'
const results = []
const check = (name, ok, extra = '') => {
  results.push([ok, name, extra])
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
page.on('pageerror', (e) => check('sin errores JS en página', false, e.message))

await page.goto(BASE)
check('carga la app', (await page.textContent('h1')) === 'TCG Vault')
check('estado vacío visible', (await page.textContent('.empty')).includes('Todavía no registraste'))

// ── alta por URL de TCGPlayer ──
await page.click('nav button:has-text("Agregar")')
await page.fill('.search-input', 'https://www.tcgplayer.com/product/543603/one-piece-card-game-sabo-001')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('URL TCGPlayer → encuentra Sabo', (await page.textContent('.add-form h3')) === 'Sabo (001)')
check('variante con precio', (await page.textContent('.af-market strong')).includes('$2.13'))
await page.fill('.af-fields input[type="number"][step="0.01"]', '1.50')
await page.click('button:has-text("Agregar a la colección")')
await page.waitForSelector('table')
check('carta en la tabla', (await page.textContent('tbody')).includes('Sabo (001)'))

// ── alta por código One Piece ──
await page.click('nav button:has-text("Agregar")')
await page.fill('.search-input', 'st13-1')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('código st13-1 normalizado → ST13-001', (await page.textContent('.add-form h3')) === 'Sabo (001)')
await page.click('button:has-text("Agregar a la colección")')

// ── totales ──
await page.waitForSelector('table')
const stats = await page.textContent('.stats')
check('total cartas = 2', stats.includes('2'))
check('G/P calculada', /[+-]\$/.test(stats))

// ── edición de cantidad ──
await page.fill('tbody tr:first-child input.qty', '3')
await page.waitForTimeout(200)
check('total tras editar qty = 4', (await page.textContent('.stats')).includes('4'))

// ── persistencia (reload) ──
await page.reload()
await page.waitForSelector('table')
check('persiste tras recargar', (await page.textContent('tbody')).includes('Sabo (001)'))

// ── actualizar precios (fuente csv, mismo origen) ──
await page.click('button:has-text("Actualizar precios")')
await page.waitForSelector('.toast', { timeout: 8000 })
check('refresh de precios OK', (await page.textContent('.toast')).includes('Precios actualizados'))

// ── búsqueda por nombre One Piece (índice local) ──
await page.click('nav button:has-text("Agregar")')
await page.fill('.search-input', 'sabo')
await page.selectOption('.search-row select', 'op')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('búsqueda por nombre OP', (await page.textContent('.add-form h3')) === 'Sabo (001)')

// ── export JSON ──
await page.click('nav button:has-text("Ajustes")')
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 5000 }),
  page.click('button:has-text("Exportar JSON")'),
])
check('export descarga archivo', (download.suggestedFilename() || '').startsWith('tcg-vault-backup-'))

await page.screenshot({ path: '/tmp/tcg-vault-collection.png', fullPage: true })
await browser.close()

const failed = results.filter(([ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} checks OK`)
process.exit(failed.length ? 1 : 0)
