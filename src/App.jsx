import { useEffect, useRef, useState } from 'react'
import AddCard from './components/AddCard.jsx'
import CollectionTable from './components/CollectionTable.jsx'
import Settings from './components/Settings.jsx'
import { loadCollection, saveCollection } from './lib/storage.js'
import { totals, fmtMoney } from './lib/helpers.js'
import { refreshCsvPrices } from './api/tcgcsv.js'
import { refreshPtcgPrices } from './api/pokemontcg.js'
import { syncEnabled, onAuthChange, signInWithGoogle, signOut, initialMerge, pushItems, onRemoteChange } from './api/sync.js'

export default function App() {
  const [items, setItems] = useState(loadCollection)
  const [tab, setTab] = useState('col')
  const [msg, setMsg] = useState('')
  const [refreshing, setRefreshing] = useState(null) // null | {done, total}
  const [user, setUser] = useState(null)
  const skipNextPush = useRef(false) // true cuando el cambio vino de la nube
  const pushTimer = useRef(null)

  // sesión de Google (si Firebase está configurado)
  useEffect(() => {
    if (!syncEnabled) return
    return onAuthChange(setUser)
  }, [])

  // al iniciar sesión: combinar local + nube, y escuchar cambios de otros dispositivos
  useEffect(() => {
    if (!user) return
    let unsub = () => {}
    let cancelled = false
    ;(async () => {
      try {
        const merged = await initialMerge(user.uid, loadCollection())
        if (cancelled) return
        skipNextPush.current = true
        setItems(merged)
        toast(`Sincronizado con tu cuenta (${merged.length} cartas).`)
        unsub = onRemoteChange(user.uid, (remoteItems) => {
          skipNextPush.current = true
          setItems(remoteItems)
        })
      } catch (err) {
        toast(`Error de sincronización: ${err.message}`)
      }
    })()
    return () => {
      cancelled = true
      unsub()
    }
  }, [user])

  // persistir: siempre local; si hay sesión, también a la nube (con debounce)
  useEffect(() => {
    saveCollection(items)
    if (!user) return
    if (skipNextPush.current) {
      skipNextPush.current = false
      return
    }
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      pushItems(user.uid, items).catch((err) => toast(`No pude guardar en la nube: ${err.message}`))
    }, 800)
    return () => window.clearTimeout(pushTimer.current)
  }, [items, user])

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

  async function refreshPrices() {
    if (refreshing || !items.length) return
    const csvIds = items.filter((it) => it.source === 'csv').map((it) => it.sourceId)
    const ptcgIds = items.filter((it) => it.source === 'ptcg').map((it) => it.sourceId)
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
      toast(`Precios actualizados (${updated} de ${items.length} cartas).`)
    } catch (err) {
      toast(`Error actualizando precios: ${err.message}`)
    } finally {
      setRefreshing(null)
    }
  }

  const t = totals(items)

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">🃏</span>
          <div>
            <h1>TCG Vault</h1>
            <p>Pokémon & One Piece · precios de TCGPlayer</p>
          </div>
        </div>
        <div className="stats">
          <Stat label="Cartas" value={t.cards.toLocaleString()} />
          <Stat label="Invertido" value={fmtMoney(t.invested)} />
          <Stat label="Valor de mercado" value={fmtMoney(t.value)} />
          <Stat label="Ganancia / Pérdida" value={`${t.pl >= 0 ? '+' : ''}${fmtMoney(t.pl)}`} tone={t.pl >= 0 ? 'gain' : 'loss'} />
        </div>
        {syncEnabled && (
          <div className="auth">
            {user ? (
              <>
                {user.photo && <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" />}
                <div className="auth-info">
                  <span className="auth-name">{user.name || user.email}</span>
                  <span className="auth-state">✓ sincronizado</span>
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

      <nav className="tabs">
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
        <button className="btn primary" onClick={refreshPrices} disabled={!!refreshing || !items.length}>
          {refreshing ? `Actualizando ${refreshing.done}/${refreshing.total}…` : '↻ Actualizar precios'}
        </button>
      </nav>

      {msg && <div className="toast">{msg}</div>}

      <main>
        {tab === 'col' && <CollectionTable items={items} onUpdate={updateItem} onRemove={removeItem} />}
        {tab === 'add' && <AddCard onAdd={addItem} />}
        {tab === 'set' && <Settings items={items} onReplaceCollection={setItems} toast={toast} />}
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

function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={tone || ''}>{value}</strong>
    </div>
  )
}
