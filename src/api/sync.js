/**
 * Sincronización opcional con Firebase (login con Google + Firestore).
 *
 * Diseño:
 *  - Documento único por usuario: vaults/{uid} → { items, deleted, updatedAt, updatedBy }
 *    `deleted` son las lápidas (uid → fecha) de las cartas borradas; ver storage.js.
 *  - Al iniciar sesión se COMBINA lo local con lo remoto (unión por uid de
 *    carta, sin duplicar, respetando las lápidas de ambos lados) y se sube
 *    el resultado.
 *  - Cada cambio local se sube con debounce. Cambios remotos (otro
 *    dispositivo) llegan en vivo vía onSnapshot y se aplican si no son
 *    nuestros (updatedBy distinto).
 *  - Si firebaseConfig es null, todo esto queda desactivado.
 */

import { firebaseConfig } from '../firebase-config.js'
import { mergeCollections, mergeDeleted, pruneDeleted } from '../lib/storage.js'

export const syncEnabled = !!firebaseConfig

// id de este cliente (pestaña/dispositivo) para ignorar nuestros propios ecos
const CLIENT_ID = `cl_${Math.random().toString(36).slice(2, 10)}`

let fb = null // { auth, db, ... } cargado bajo demanda

async function init() {
  if (!syncEnabled) return null
  if (fb) return fb
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  const app = initializeApp(firebaseConfig)
  // Persistencia de sesión en localStorage (NO IndexedDB): evita el error
  // "Database is closing/hidden" que da IndexedDB en algunos navegadores.
  let auth
  try {
    auth = authMod.initializeAuth(app, {
      persistence: authMod.browserLocalPersistence,
      popupRedirectResolver: authMod.browserPopupRedirectResolver,
    })
  } catch {
    auth = authMod.getAuth(app)
  }
  fb = {
    auth,
    db: fsMod.getFirestore(app),
    authMod,
    fsMod,
  }
  return fb
}

/** Escucha cambios de sesión. Devuelve función para desuscribirse. */
export function onAuthChange(callback) {
  if (!syncEnabled) return () => {}
  let unsub = () => {}
  init().then(({ auth, authMod }) => {
    unsub = authMod.onAuthStateChanged(auth, (user) =>
      callback(user ? { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL } : null)
    )
  })
  return () => unsub()
}

export async function signInWithGoogle() {
  const { auth, authMod } = await init()
  const provider = new authMod.GoogleAuthProvider()
  try {
    await authMod.signInWithPopup(auth, provider)
  } catch (err) {
    // popup bloqueado (algunos navegadores móviles) → redirect
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
      if (err.code === 'auth/popup-blocked') await authMod.signInWithRedirect(auth, provider)
    } else {
      throw err
    }
  }
}

export async function signOut() {
  const { auth, authMod } = await init()
  await authMod.signOut(auth)
}

function vaultRef(uid) {
  const { db, fsMod } = fb
  return fsMod.doc(db, 'vaults', uid)
}

/**
 * Firestore no admite arrays anidados, y el historial de precios de cada
 * carta es una lista de pares [día, precio]. En el documento va aplanado
 * ([día, precio, día, precio, …]) y se vuelve a armar al leer.
 */
export function packItems(items) {
  return items.map((it) => (Array.isArray(it.hist) ? { ...it, hist: it.hist.flat() } : it))
}

export function unpackItems(items) {
  return (items || []).map((it) => {
    if (!Array.isArray(it.hist) || !it.hist.length || Array.isArray(it.hist[0])) return it
    const hist = []
    for (let i = 0; i + 1 < it.hist.length; i += 2) hist.push([it.hist[i], it.hist[i + 1]])
    return { ...it, hist }
  })
}

/** documento crudo de Firestore → { items, deleted } */
function fromDoc(data) {
  return { items: unpackItems(data?.items), deleted: data?.deleted || {} }
}

/**
 * Baja lo remoto, lo combina con lo local ({ items, deleted }) y sube el
 * resultado. Devuelve el combinado.
 *
 * `getLocal` es una función y se llama recién DESPUÉS de bajar la nube: lo
 * local puede cambiar mientras tanto (por ejemplo, el refresco automático de
 * precios), y combinar con una copia vieja pisaría esos cambios.
 */
export async function initialMerge(uid, getLocal) {
  await init()
  const { fsMod } = fb
  const snap = await fsMod.getDoc(vaultRef(uid))
  const remote = fromDoc(snap.exists() ? snap.data() : null)
  const local = getLocal()
  const deleted = pruneDeleted(mergeDeleted(remote.deleted, local.deleted))
  const items = mergeCollections(remote.items, local.items, deleted)
  const merged = { items, deleted }
  await pushVault(uid, merged)
  return merged
}

/** Sube la colección completa (documento único, last-write-wins). */
export async function pushVault(uid, { items, deleted }) {
  await init()
  const { fsMod } = fb
  await fsMod.setDoc(vaultRef(uid), {
    items: packItems(items),
    deleted: deleted || {},
    updatedAt: new Date().toISOString(),
    updatedBy: CLIENT_ID,
  })
}

/** Escucha cambios remotos (de otros dispositivos). Devuelve unsubscribe. */
export function onRemoteChange(uid, callback) {
  if (!fb) return () => {}
  const { fsMod } = fb
  return fsMod.onSnapshot(vaultRef(uid), (snap) => {
    if (!snap.exists()) return
    const data = snap.data()
    // ignorar ecos de este mismo cliente y escrituras locales pendientes
    if (data.updatedBy === CLIENT_ID || snap.metadata.hasPendingWrites) return
    callback(fromDoc(data))
  })
}
