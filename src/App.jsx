import { useEffect, useMemo, useRef, useState } from 'react'
import AddCard from './components/AddCard.jsx'
import CollectionTable from './components/CollectionTable.jsx'
import Settings from './components/Settings.jsx'
import GamePicker from './components/GamePicker.jsx'
import PriceHistory from './components/PriceHistory.jsx'
import Icon from './components/Icon.jsx'
import logo from './assets/logo-tcg-vault.png'
import {
  loadCollection,
  saveCollection,
  loadDeleted,
  saveDeleted,
  mergeCollections,
  mergeDeleted,
  pruneDeleted,
  tombstones,
} from './lib/storage.js'
import { totals, fmtMoney, fmtDate, fmtDelta, dirCls, GAME_LABEL, variantLabel, recordPrice, histOf } from './lib/helpers.js'
import { getMeta, refreshCsvPrices } from './api/tcgcsv.js'
import { refreshPtcgPrices } from './api/pokemontcg.js'
import { syncEnabled, onAuthChange, signInWithGoogle, signOut, initialMerge, pushVault, onRemoteChange } from './api/sync.js'

/** Pestañas de la colección. `title` es lo que se lee cuando el texto se oculta. */
const TABS = [
  { id: 'col', icon: 'cards', label: 'Colección', title: 'Colección' },
  { id: 'add', icon: 'plus', label: '+ Agregar', title: 'Agregar carta' },
  { id: 'hist', icon: 'chart', label: 'Precios', title: 'Evolución de precios' },
  { id: 'set', icon: 'sliders', label: 'Ajustes', title: 'Ajustes' },
]

/** Espera tras el último cambio antes de subir a la nube (cada tecla en
 *  "cantidad" o "pagado" es un cambio; no vale la pena subir cada una). */
const PUSH_DEBOUNCE_MS = 1000

/** Lo que se guarda y sincroniza: la colección más las lápidas de lo borrado. */
const snapshot = (items, deleted) => JSON.stringify({ items, deleted })

/**
 * Aplica precios nuevos a una lista de cartas y anota cada uno en su
 * historial. `only` limita a un juego. Devuelve la lista nueva y cuántas
 * cartas cambiaron.
 */
function applyPrices(items, { csvMap, ptcgMap, now, only }) {
  let updated = 0
  const next = items.map((it) => {
    if (only && it.game !== only) return it
    const map = it.source === 'csv' ? csvMap : ptcgMap
    const price = map?.get(it.sourceId)?.[it.variant]?.market
    if (price == null) return it
    updated++
    return { ...it, mkt: price, mktAt: now, hist: recordPrice(histOf(it), price, now) }
  })
  return { next, updated }
}

/** Precio pagado promedio al sumar `b` (nuevo) a `a` (existente, con qty `qa`). */
function avgPaid(a, b, qa) {
  if (a.paid == null) return b.paid
  if (b.paid == null) return a.paid
  return Math.round(((a.paid * qa + b.paid * b.qty) / (qa + b.qty)) * 100) / 100
}

export default function App() {
  const [items, setItems] = useState(loadCollection)
  const [deleted, setDeleted] = useState(() => pruneDeleted(loadDeleted()))
  const [game, setGame] = useState(null) // null = pantalla de elección de juego
  const [tab, setTab] = useState('col')
  const [histFocus, setHistFocus] = useState(null) // uid de la carta elegida en «Precios»
  const [msg, setMsg] = useState('')
  const [refreshing, setRefreshing] = useState(null) // null | {done, total}
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(!syncEnabled) // true cuando ya se sabe si hay sesión o no
  // estado de la nube: 'off' | 'syncing' | 'saved' | 'pending' | 'error'
  const [cloud, setCloud] = useState({ state: 'off', at: null })
  const synced = useRef(false) // true recién cuando terminó la combinación inicial
  const lastPushed = useRef(null) // snapshot de lo último confirmado en la nube
  const pushTimer = useRef(null)
  const toastTimer = useRef(null)
  const vault = useRef({ items, deleted }) // lo actual, para leer desde callbacks
  vault.current = { items, deleted }

  // sesión de Google (si Firebase está configurado)
  useEffect(() => {
    if (!syncEnabled) return
    return onAuthChange((u) => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  // al iniciar sesión: PRIMERO bajar la nube y combinar; hasta que eso no
  // termine (synced=true) este dispositivo tiene prohibido subir nada.
  useEffect(() => {
    if (!user) {
      synced.current = false
      lastPushed.current = null
      setCloud({ state: 'off', at: null })
      return
    }
    let unsub = () => {}
    let cancelled = false
    setCloud({ state: 'syncing', at: null })
    ;(async () => {
      try {
        // lo local se lee recién después de bajar la nube (ver initialMerge)
        const merged = await initialMerge(user.uid, () => vault.current)
        if (cancelled) return
        lastPushed.current = snapshot(merged.items, merged.deleted)
        synced.current = true
        setItems(merged.items)
        setDeleted(merged.deleted)
        setCloud({ state: 'saved', at: new Date() })
        toast(`Sincronizado con tu cuenta (${merged.items.length} cartas).`)
        unsub = onRemoteChange(user.uid, (remote) => {
          const local = vault.current
          if (snapshot(local.items, local.deleted) !== lastPushed.current) {
            // hay cambios locales sin subir → combinar en vez de pisar
            const d = mergeDeleted(remote.deleted, local.deleted)
            setDeleted(d)
            setItems(mergeCollections(remote.items, local.items, d)) // queda distinto de lastPushed → se re-sube solo
          } else {
            lastPushed.current = snapshot(remote.items, remote.deleted)
            setItems(remote.items)
            setDeleted(remote.deleted)
            setCloud({ state: 'saved', at: new Date() })
          }
        })
      } catch (err) {
        setCloud({ state: 'error', at: null })
        toast(`Error de sincronización: ${err.message}`)
      }
    })()
    return () => {
      cancelled = true
      synced.current = false
      unsub()
    }
  }, [user])

  // persistir: siempre local; a la nube solo cambios reales y solo después
  // de la sincronización inicial (así un dispositivo "vacío" jamás pisa la nube)
  useEffect(() => {
    saveCollection(items)
    saveDeleted(deleted)
    if (!user || !synced.current) return
    const json = snapshot(items, deleted)
    if (json === lastPushed.current) return // vino de la nube o ya está subido
    setCloud({ state: 'pending', at: null })
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(async () => {
      try {
        await pushVault(user.uid, { items, deleted })
        lastPushed.current = json
        setCloud({ state: 'saved', at: new Date() })
      } catch (err) {
        setCloud({ state: 'error', at: null })
        toast(`No pude guardar en la nube: ${err.message}`)
      }
    }, PUSH_DEBOUNCE_MS)
    return () => window.clearTimeout(pushTimer.current)
  }, [items, deleted, user])

  // red de seguridad: si cerrás/minimizás la pestaña con un guardado pendiente,
  // se intenta subir inmediatamente
  useEffect(() => {
    if (!user) return
    function flush() {
      if (!synced.current) return
      const { items, deleted } = vault.current
      const json = snapshot(items, deleted)
      if (json !== lastPushed.current) {
        pushVault(user.uid, { items, deleted })
          .then(() => {
            lastPushed.current = json
          })
          .catch(() => {})
      }
    }
    function onHide() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [user])

  // precios al día al abrir: si el catálogo diario es más nuevo que el último
  // refresco de alguna carta, se actualiza sola (mismo origen, sin límites).
  // Espera a saber si hay sesión y, si la hay, a que termine la sincronización
  // inicial: si corriera en paralelo, la combinación con la nube pisaría los
  // precios recién bajados y sus puntos de historial.
  const autoRefreshed = useRef(false)
  useEffect(() => {
    if (autoRefreshed.current || !authReady) return
    if (user && cloud.state !== 'saved' && cloud.state !== 'error') return
    autoRefreshed.current = true
    let cancelled = false
    ;(async () => {
      const meta = await getMeta()
      if (cancelled || !meta?.updatedAt) return
      const stale = vault.current.items.filter(
        (it) => it.source === 'csv' && (!it.mktAt || it.mktAt < meta.updatedAt)
      )
      if (!stale.length) return
      const csvMap = await refreshCsvPrices(stale.map((it) => it.sourceId))
      if (cancelled) return
      const now = new Date().toISOString()
      const { updated } = applyPrices(stale, { csvMap, now })
      if (!updated) return
      setItems((prev) => applyPrices(prev, { csvMap, now }).next)
      toast(`Precios al día: ${updated} cartas actualizadas al catálogo del ${fmtDate(meta.updatedAt)}.`)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [authReady, user, cloud.state])

  function toast(text) {
    setMsg(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setMsg(''), 4000)
  }

  function addItem(item) {
    // misma carta, variante y condición → ofrecer sumar en vez de duplicar la fila
    const dup = vault.current.items.find(
      (it) =>
        it.source === item.source && it.sourceId === item.sourceId && it.variant === item.variant && it.cond === item.cond
    )
    if (dup) {
      const have = dup.qty || 1
      const sum = confirm(
        `Ya tenés ${have} de «${item.name}» (${variantLabel(item.variant) || 'sin variante'}, ${item.cond}). ¿Sumar ${item.qty} a esa fila en vez de agregar otra?`
      )
      if (sum) {
        updateItem(dup.uid, {
          qty: have + item.qty,
          paid: avgPaid(dup, item, have),
          mkt: item.mkt ?? dup.mkt,
          mktAt: item.mkt != null ? item.mktAt : dup.mktAt,
          hist: item.mkt != null ? recordPrice(histOf(dup), item.mkt, item.mktAt) : histOf(dup),
        })
        setTab('col')
        toast(`«${item.name}»: ahora tenés ${have + item.qty}.`)
        return
      }
    }
    setItems((prev) => [item, ...prev])
    setTab('col')
    toast(`«${item.name}» agregada a la colección.`)
  }

  function updateItem(uid, patch) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
  }

  function removeItem(uid) {
    setItems((prev) => prev.filter((it) => it.uid !== uid))
    setDeleted((prev) => ({ ...prev, ...tombstones([uid]) }))
  }

  /**
   * Reemplaza la colección entera (importar / borrar todo). Lo que desaparece
   * queda con lápida para que no vuelva desde otro dispositivo. Con `restore`
   * (importar reemplazando) el archivo manda: se levantan las lápidas de lo
   * que trae.
   */
  function replaceCollection(next, { restore = false } = {}) {
    const keep = new Set(next.map((it) => it.uid))
    const gone = vault.current.items.filter((it) => !keep.has(it.uid)).map((it) => it.uid)
    setDeleted((prev) => {
      const d = { ...prev, ...tombstones(gone) }
      if (restore) for (const it of next) delete d[it.uid]
      return d
    })
    setItems(next)
  }

  // todo lo visible (tabla, totales, refresco de precios) es del juego elegido
  const scoped = useMemo(() => (game ? items.filter((it) => it.game === game) : items), [items, game])

  function pickGame(id) {
    setGame(id)
    setTab('col')
  }

  /** Desde el modal de una carta: abre «Precios» con esa carta elegida. */
  function showHistory(uid) {
    setHistFocus(uid)
    setTab('hist')
  }

  async function refreshPrices() {
    if (refreshing || !scoped.length) return
    const csvIds = scoped.filter((it) => it.source === 'csv').map((it) => it.sourceId)
    const ptcgIds = scoped.filter((it) => it.source === 'ptcg').map((it) => it.sourceId)
    const total = new Set(csvIds).size + new Set(ptcgIds).size
    setRefreshing({ done: 0, total })
    let done = 0
    try {
      const csvMap = csvIds.length ? await refreshCsvPrices(csvIds) : new Map()
      done += new Set(csvIds).size
      setRefreshing({ done, total })

      const ptcgMap = ptcgIds.length
        ? await refreshPtcgPrices(ptcgIds, (i) => setRefreshing({ done: done + i, total }))
        : new Map()

      const now = new Date().toISOString()
      const { updated } = applyPrices(scoped, { csvMap, ptcgMap, now })
      // forma funcional: no pisa lo que cambió mientras bajaban los precios
      setItems((prev) => applyPrices(prev, { csvMap, ptcgMap, now, only: game }).next)
      toast(`Precios actualizados (${updated} de ${scoped.length} cartas).`)
    } catch (err) {
      toast(`Error actualizando precios: ${err.message}`)
    } finally {
      setRefreshing(null)
    }
  }

  const t = totals(scoped)

  return (
    <div className="app">
      <header>
        <div className="brand">
          <img className="logo" src={logo} alt="TCG Vault" />
          <div>
            <h1>
              TCG <span>Vault</span>
            </h1>
            <p>{game ? `Colección de ${GAME_LABEL[game]}` : 'Pokémon & One Piece · precios de TCGPlayer'}</p>
          </div>
        </div>
        <div className="stats">
          <Stat label="Cartas" value={t.cards.toLocaleString()} />
          <Stat label="Valor de mercado" value={fmtMoney(t.value)} />
          <Stat
            label="Desde que las agregaste"
            value={t.initial ? fmtDelta({ abs: t.change, pct: t.change / t.initial }) : '—'}
            className={dirCls(t.change)}
          />
          {t.invested > 0 && (
            <>
              <Stat label="Invertido" value={fmtMoney(t.invested)} />
              <Stat label="G/P vs pagado" value={fmtDelta({ abs: t.pl, pct: t.pl / t.invested })} className={dirCls(t.pl)} />
            </>
          )}
        </div>
        {syncEnabled && (
          <div className="auth">
            {user ? (
              <>
                {user.photo && <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" />}
                <div className="auth-info">
                  <span className="auth-name">{user.name || user.email}</span>
                  <CloudState cloud={cloud} />
                </div>
                <button className="btn" onClick={() => signOut().catch(() => {})}>
                  Salir
                </button>
              </>
            ) : (
              <button
                className="btn"
                onClick={() => signInWithGoogle().catch((err) => toast(`No pude iniciar sesión: ${err.message}`))}
              >
                Entrar con Google
              </button>
            )}
          </div>
        )}
      </header>

      {game && (
        <nav className="tabs">
          <button className="btn ghost back" onClick={() => setGame(null)} title="Volver a elegir juego" aria-label="Volver a elegir juego">
            <Icon name="back" />
            <span className="tab-text">← Juegos</span>
          </button>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'on' : ''}
              onClick={() => setTab(t.id)}
              title={t.title}
              aria-label={t.title}
            >
              <Icon name={t.icon} />
              <span className="tab-text">{t.label}</span>
            </button>
          ))}
          <div className="spacer" />
          <button
            className="btn primary"
            onClick={refreshPrices}
            disabled={!!refreshing || !scoped.length || cloud.state === 'syncing'}
            title="Actualizar precios"
            aria-label="Actualizar precios"
          >
            <Icon name="refresh" className={refreshing ? 'spin' : ''} />
            <span className="tab-text">
              {refreshing ? `Actualizando ${refreshing.done}/${refreshing.total}…` : 'Actualizar precios'}
            </span>
            {/* en celular el texto se oculta: el progreso se muestra igual, compacto */}
            {refreshing && <span className="tab-progress">{`${refreshing.done}/${refreshing.total}`}</span>}
          </button>
        </nav>
      )}

      {msg && <div className="toast">{msg}</div>}

      <main>
        {!game && <GamePicker items={items} onPick={pickGame} />}
        {game && tab === 'col' && (
          <CollectionTable items={scoped} game={game} onUpdate={updateItem} onRemove={removeItem} onShowHistory={showHistory} />
        )}
        {game && tab === 'add' && <AddCard game={game} onAdd={addItem} />}
        {game && tab === 'hist' && <PriceHistory items={scoped} game={game} focus={histFocus} onFocus={setHistFocus} />}
        {game && tab === 'set' && (
          <Settings items={items} deleted={deleted} onReplaceCollection={replaceCollection} toast={toast} />
        )}
      </main>

      <footer>
        <p>
          Precios de mercado de TCGPlayer vía{' '}
          <a href="https://tcgcsv.com" target="_blank" rel="noreferrer">
            tcgcsv.com
          </a>{' '}
          y{' '}
          <a href="https://pokemontcg.io" target="_blank" rel="noreferrer">
            pokemontcg.io
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

function Stat({ label, value, className = '' }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={className}>{value}</strong>
    </div>
  )
}

/** Indicador del estado de guardado en la nube. */
function CloudState({ cloud }) {
  const hora = (d) => d?.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  switch (cloud.state) {
    case 'syncing':
      return <span className="auth-state" style={{ color: 'var(--muted)' }}>⟳ sincronizando…</span>
    case 'pending':
      return <span className="auth-state" style={{ color: 'var(--muted)' }}>⟳ guardando…</span>
    case 'saved':
      return <span className="auth-state">✓ guardado en la nube {cloud.at ? hora(cloud.at) : ''}</span>
    case 'error':
      return <span className="auth-state" style={{ color: 'var(--loss)' }}>⚠ error al guardar</span>
    default:
      return null
  }
}
