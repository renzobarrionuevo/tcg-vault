/**
 * Sincronización opcional con Firebase (login con Google + Firestore).
 *
 * Diseño:
 *  - Documento único por usuario: vaults/{uid} → { items, updatedAt, updatedBy }
 *  - Al iniciar sesión se COMBINA lo local con lo remoto (unión por uid de
 *    carta, sin duplicar) y se sube el resultado.
 *  - Cada cambio local se sube con debounce. Cambios remotos (otro
 *    dispositivo) llegan en vivo vía onSnapshot y se aplican si no son
 *    nuestros (updatedBy distinto).
 *  - Si firebaseConfig es null, todo esto queda desactivado.
 */

import { firebaseConfig } from '../firebase-config.js'
import { mergeCollections } from '../lib/storage.js'

export const syncEnabled = !!firebaseConfig

// id de este cliente (pestaña/dispositivo) para ignorar nuestros propios ecos
const CLIENT_ID = `cl_${Math.random().toString(36).slice(2, 10)}`

let fb = null // { auth, db, doc, setDoc, onSnapshot, ... } cargado bajo demanda

async function init() {
  if (!syncEnabled) return null
  if (fb) return fb
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  const app = initializeApp(firebaseConfig)
  fb = {
    auth: authMod.getAuth(app),
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

/** Baja lo remoto, lo combina con lo local y sube el resultado. Devuelve la lista combinada. */
export async function initialMerge(uid, localItems) {
  await init()
  const { fsMod } = fb
  const snap = await fsMod.getDoc(vaultRef(uid))
  const remoteItems = snap.exists() ? snap.data().items || [] : []
  const merged = mergeCollections(remoteItems, localItems)
  await pushItems(uid, merged)
  return merged
}

/** Sube la colección completa (documento único, last-write-wins). */
export async function pushItems(uid, items) {
  await init()
  const { fsMod } = fb
  await fsMod.setDoc(vaultRef(uid), {
    items,
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
    callback(data.items || [])
  })
}
