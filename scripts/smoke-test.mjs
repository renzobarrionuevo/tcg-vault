/**
 * Smoke test E2E con Playwright contra el build de producción (vite preview).
 * Ejercita: elección de juego, alta por URL de TCGPlayer, alta por código OP
 * (sumando a la fila existente), edición, totales, persistencia en
 * localStorage, actualización de precios, búsqueda por nombre en los índices
 * locales de los dos juegos y export JSON.
 *
 * Requiere los fixtures (node scripts/make-fixtures.mjs), `npm run build` y
 * `npm run preview` corriendo. (Solo para desarrollo; no forma parte del deploy.)
 */
import { chromium } from 'playwright'

const BASE = process.env.SMOKE_BASE || 'http://localhost:4173/'
const results = []
const check = (name, ok, extra = '') => {
  results.push([ok, name, extra])
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage()
page.on('pageerror', (e) => check('sin errores JS en página', false, e.message))
// los confirm() de la app (sumar duplicado, borrar) se aceptan
page.on('dialog', (d) => d.accept())

await page.goto(BASE)
check('carga la app', (await page.textContent('h1')) === 'TCG Vault')
check('pantalla de elección de juego', (await page.textContent('.game-picker h2')).includes('Elegí'))

// ── One Piece ──
await page.click('.game-banner.op')
check('estado vacío visible', (await page.textContent('.empty')).includes('Todavía no registraste'))

// alta por URL de TCGPlayer
await page.click('nav button[title="Agregar carta"]')
await page.fill('.search-input', 'https://www.tcgplayer.com/product/543603/one-piece-card-game-sabo-001')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('URL TCGPlayer → encuentra Sabo', (await page.textContent('.add-form h3')) === 'Sabo (001)')
check('variante con precio', (await page.textContent('.af-market strong')).includes('$2.13'))
check('imagen deducida del productId', (await page.getAttribute('.af-card img', 'src')).includes('/543603_200w.jpg'))
await page.fill('.af-fields input[type="number"][step="0.01"]', '1.50')
await page.click('button:has-text("Agregar a la colección")')
await page.waitForSelector('table')
check('carta en la tabla', (await page.textContent('tbody')).includes('Sabo (001)'))

// alta por código One Piece: misma carta → se suma a la fila existente
await page.click('nav button[title="Agregar carta"]')
await page.fill('.search-input', 'st13-1')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('código st13-1 normalizado → ST13-001', (await page.textContent('.add-form h3')) === 'Sabo (001)')
await page.click('button:has-text("Agregar a la colección")')
await page.waitForSelector('table')
check('duplicado sumado a la misma fila', (await page.$$('tbody tr')).length === 1)
check('cantidad = 2', (await page.inputValue('tbody tr:first-child input.qty')) === '2')

// totales
const stats = await page.textContent('.stats')
check('total cartas = 2', /Cartas2/.test(stats.replace(/\s/g, '')))
check('G/P calculada', /[+-]\$/.test(stats))

// edición de cantidad
await page.fill('tbody tr:first-child input.qty', '3')
await page.waitForTimeout(200)
check('total tras editar qty = 3', /Cartas3/.test((await page.textContent('.stats')).replace(/\s/g, '')))

// persistencia (reload)
await page.reload()
await page.click('.game-banner.op')
await page.waitForSelector('table')
check('persiste tras recargar', (await page.textContent('tbody')).includes('Sabo (001)'))

// actualizar precios (fuente csv, mismo origen)
await page.click('nav button[title="Actualizar precios"]')
await page.waitForSelector('.toast:has-text("Precios actualizados")', { timeout: 8000 })
check('refresh de precios OK', true)

// búsqueda por nombre One Piece (índice local): un solo resultado → formulario directo
await page.click('nav button[title="Agregar carta"]')
await page.fill('.search-input', 'sabo')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('búsqueda por nombre OP', (await page.textContent('.add-form h3')) === 'Sabo (001)')

// carta en grande: la miniatura abre el modal con la imagen de 1000 px; Escape lo cierra
await page.click('nav button[title="Colección"]')
await page.click('tbody tr:first-child .thumb-btn')
await page.waitForSelector('.modal img', { timeout: 5000 })
check('modal con la carta grande', (await page.getAttribute('.modal img', 'src')).includes('_in_1000x1000.jpg'))
check('leyenda del modal', (await page.textContent('.modal-caption')).includes('Sabo (001)'))
await page.keyboard.press('Escape')
await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 })
check('Escape cierra el modal', true)

// borrar: la fila desaparece
await page.click('tbody tr:first-child button[title="Eliminar"]')
await page.waitForSelector('.empty')
check('borrar deja la colección vacía', true)

// ── Pokémon (índice local, sin pokemontcg.io) ──
await page.click('nav button[title="Volver a elegir juego"]')
await page.click('.game-banner.pk')
await page.click('nav button[title="Agregar carta"]')
await page.fill('.search-input', 'charizard')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('búsqueda Pokémon local → Charizard ex', (await page.textContent('.add-form h3')) === 'Charizard ex')
check('precio Pokémon desde el shard', (await page.textContent('.af-market strong')).includes('$12.50'))
await page.click('button:has-text("Agregar a la colección")')
await page.waitForSelector('table')

// varios resultados → grilla, elegir uno carga los precios
await page.click('nav button[title="Agregar carta"]')
await page.fill('.search-input', 'e')
await page.click('button:has-text("Buscar")')
await page.waitForSelector('.results-grid', { timeout: 5000 })
check('varios resultados → grilla', (await page.$$('.result-card')).length === 2)
await page.click('.result-card:has-text("Brute Bonnet")')
await page.waitForSelector('.add-form', { timeout: 5000 })
check('elegir un resultado carga sus precios', (await page.textContent('.add-form select')).includes('Reverse'))
await page.click('button:has-text("Agregar a la colección")')
await page.waitForSelector('table')

// flechas del modal: recorren la lista tal como está ordenada (mayor valor primero)
await page.click('tbody tr:first-child .thumb-btn')
await page.waitForSelector('.modal img')
check('modal arranca en la primera de dos', (await page.textContent('.modal-count')).trim() === '1 / 2')
check('primera = la de mayor valor', (await page.textContent('.modal-caption strong')) === 'Charizard ex')
await page.click('.modal-nav.next')
check('flecha → pasa a la siguiente', (await page.textContent('.modal-caption strong')) === 'Brute Bonnet')
check('en la última no hay flecha →', (await page.$('.modal-nav.next')) === null)
await page.keyboard.press('ArrowLeft')
check('tecla ← vuelve a la anterior', (await page.textContent('.modal-caption strong')) === 'Charizard ex')
await page.keyboard.press('Escape')
await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 })

// export JSON
await page.click('nav button[title="Ajustes"]')
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 5000 }),
  page.click('button:has-text("Exportar JSON")'),
])
check('export descarga archivo', (download.suggestedFilename() || '').startsWith('tcg-vault-backup-'))

await browser.close()

const failed = results.filter(([ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} checks OK`)
process.exit(failed.length ? 1 : 0)
