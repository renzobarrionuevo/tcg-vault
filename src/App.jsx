import { useEffect, useMemo, useRef, useState } from 'react'
import AddCard from './components/AddCard.jsx'
import CollectionTable from './components/CollectionTable.jsx'
import Settings from './components/Settings.jsx'
import GamePicker from './components/GamePicker.jsx'
import logo from './assets/logo-tcg-vault.png'
import { loadCollection, saveCollection, mergeCollections } from './lib/storage.js'
import { totals, fmtMoney, GAME_LABEL } from './lib/helpers.js'
import { refreshCsvPrices } from './api/tcgcsv.js'
import { refreshPtcgPrices } from './api/pokemontcg.js'
import { syncEnabled, onAuthChange, signInWithGoogle, signOut, initialMerge, pushItems, onRemoteChange } from './api/sync.js'

export default function App() {
  const [items, setItems] = useState(loadCollection)
  const [game, setGame] = useState(null) // null = pantalla de elección de juego
  const [tab, setTab] = useState('col')
  const [msg, setMsg] = useState('')
  const [refreshing, setRefreshing] = useState(null) // null | {done, total}
  const [user, setUser] = useState(null)
  // estado de la nube: 'off' | 'syncing' | 'saved' | 'pending' | 'error'
  const [cloud, setCloud] = useState({ state: 'off', at: null })
  const synced = useRef(false) // true recién cuando terminó la combinación inicial
  const lastPushed = useRef(null) // JSON de lo último confirmado en la nube
  const pushTimer = useRef(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // sesión de Google (si Firebase está configurado)
  useEffect(() => {
    if (!syncEnabled) return
    return onAuthChange(setUser)
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
        const merged = await initialMerge(user.uid, loadCollection())
        if (cancelled) return
        lastPushed.current = JSON.stringify(merged)
        synced.current = true
        setItems(merged)
        setCloud({ state: 'saved', at: new Date() })
        toast(`Sincronizado con tu cuenta (${merged.length} cartas).`)
        unsub = onRemoteChange(user.uid, (remoteItems) => {
          const localJson = JSON.stringify(itemsRef.current)
          if (localJson !== lastPushed.current) {
            // hay cambios locales sin subir → combinar en vez de pisar
            const combined = mergeCollections(remoteItems, itemsRef.current)
            setItems(combined) // queda distinto de lastPushed → se re-sube solo
          } else {
            lastPushed.current = JSON.stringify(remoteItems)
            setItems(remoteItems)
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
    if (!user || !synced.current) return
    const json = JSON.stringify(items)
    if (json === lastPushed.current) return // vino de la nube o ya está subido
    setCloud({ state: 'pending', at: null })
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(async () => {
      try {
        await pushItems(user.uid, items)
        lastPushed.current = json
        setCloud({ state: 'saved', at: new Date() })
      } catch (err) {
        setCloud({ state: 'error', at: null })
        toast(`No pude guardar en la nube: ${err.message}`)
      }
    }, 400)
    return () => window.clearTimeout(pushTimer.current)
  }, [items, user])

  // red de seguridad: si cerrás/minimizás la pestaña con un guardado pendiente,
  // se intenta subir inmediatamente
  useEffect(() => {
    if (!user) return
    function flush() {
      if (!synced.current) return
      if (JSON.stringify(itemsRef.current) !== lastPushed.current) {
        pushItems(user.uid, itemsRef.current)
          .then(() => {
            lastPushed.current = JSON.stringify(itemsRef.current)
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

  function toast(text) {
    setMsg(text)
    window.clearTimeout(toast._t)
    toast._t = window.setTimeout(() => setMsg(''), 4000)
  }

  function addItem(item) {
    setItems((prev) => [item, ...prev])
    setTab('col')
    toast(`«${item.name}» agregada a la colección.`)
  }

  function updateItem(uid, patch) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
  }

  function removeItem(uid) {
    setItems((prev) => prev.filter((it) => it.uid !== uid))
  }

  // todo lo visible (tabla, totales, refresco de precios) es del juego elegido
  const scoped = useMemo(() => (game ? items.filter((it) => it.game === game) : items), [items, game])

  function pickGame(id) {
    setGame(id)
    setTab('col')
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
      let updated = 0
      const next = items.map((it) => {
        if (game && it.game !== game) return it // el otro juego no se toca
        const map = it.source === 'csv' ? csvMap : ptcgMap
        const variants = map.get(it.sourceId)
        const price = variants?.[it.variant]?.market
        if (price != null) {
          updated++
          return { ...it, mkt: price, mktAt: now }
        }
        return it
      })
      setItems(next)
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
            <h1>TCG Vault</h1>
            <p>{game ? `Colección de ${GAME_LABEL[game]}` : 'Pokémon & One Piece · precios de TCGPlayer'}</p>
          </div>
        </div>
        <div className="stats">
          <Stat label="Cartas" value={t.cards.toLocaleString()} />
          <Stat label="Valor de mercado" value={fmtMoney(t.value)} />
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
          <button className="btn ghost back" onClick={() => setGame(null)} title="Volver a elegir juego">
            ← Juegos
          </button>
          <button className={tab === 'col' ? 'on' : ''} onClick={() => setTab('col')}>
            Colección
          </button>
          <button className={tab === 'add' ? 'on' : ''} onClick={() => setTab('add')}>
            + Agregar
          </button>
          <button className={tab === 'set' ? 'on' : ''} onClick={() => setTab('set')}>
            Ajustes
          </button>
          <div className="spacer" />
          <button className="btn primary" onClick={refreshPrices} disabled={!!refreshing || !scoped.length}>
            {refreshing ? `Actualizando ${refreshing.done}/${refreshing.total}…` : '↻ Actualizar precios'}
          </button>
        </nav>
      )}

      {msg && <div className="toast">{msg}</div>}

      <main>
        {!game && <GamePicker items={items} onPick={pickGame} />}
        {game && tab === 'col' && <CollectionTable items={scoped} game={game} onUpdate={updateItem} onRemove={removeItem} />}
        {game && tab === 'add' && <AddCard game={game} onAdd={addItem} />}
        {game && tab === 'set' && <Settings items={items} onReplaceCollection={setItems} toast={toast} />}
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
          , actualizados a diario. Los datos de tu colección se guardan solo en tu navegador.
        </p>
      </footer>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
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
