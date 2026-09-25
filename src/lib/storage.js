/**
 * Persistencia en localStorage + export/import JSON.
 *
 * Se guardan dos cosas:
 *  - la colección (lista de cartas, cada una con un `uid` único), y
 *  - las "lápidas": uid → fecha de las cartas borradas. Sin ellas, combinar
 *    la colección con la de otro dispositivo (o con un respaldo viejo)
 *    resucitaría lo que se borró. Se olvidan a los TOMBSTONE_DAYS días.
 */

const COLLECTION_KEY = 'tcgvault.collection.v1'
const DELETED_KEY = 'tcgvault.deleted.v1'
const SETTINGS_KEY = 'tcgvault.settings.v1'

/** Cuánto se recuerda un borrado. Tiene que superar el tiempo máximo que un
 *  dispositivo puede pasar sin abrir la app sin que reviva cartas viejas. */
export const TOMBSTONE_DAYS = 180

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function loadCollection() {
  const data = readJson(COLLECTION_KEY, [])
  return Array.isArray(data) ? data : []
}

export function saveCollection(items) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(items))
}

export function loadDeleted() {
  const data = readJson(DELETED_KEY, {})
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
}

export function saveDeleted(deleted) {
  localStorage.setItem(DELETED_KEY, JSON.stringify(deleted))
}

export function loadSettings() {
  return readJson(SETTINGS_KEY, {}) || {}
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function newUid() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Lápidas nuevas para estos uids, todas con la misma fecha. */
export function tombstones(uids, at = new Date().toISOString()) {
  return Object.fromEntries(uids.filter(Boolean).map((uid) => [uid, at]))
}

/** Unión de dos juegos de lápidas; ante el mismo uid gana la fecha más nueva. */
export function mergeDeleted(a = {}, b = {}) {
  const out = { ...a }
  for (const [uid, at] of Object.entries(b)) {
    if (!out[uid] || out[uid] < at) out[uid] = at
  }
  return out
}

/** Descarta las lápidas más viejas que TOMBSTONE_DAYS. */
export function pruneDeleted(deleted = {}, now = Date.now()) {
  const cutoff = new Date(now - TOMBSTONE_DAYS * 86400000).toISOString()
  return Object.fromEntries(Object.entries(deleted).filter(([, at]) => at >= cutoff))
}

/** Descarga la colección como archivo JSON. */
export function exportCollection(items) {
  const payload = {
    app: 'tcg-vault',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tcg-vault-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Lee un archivo de respaldo. Devuelve la lista de items o lanza error. */
export async function parseBackupFile(file) {
  const text = await file.text()
  const data = JSON.parse(text)
  const items = Array.isArray(data) ? data : data.items
  if (!Array.isArray(items)) throw new Error('El archivo no tiene el formato esperado.')
  return items.filter((it) => it && it.name && it.source)
}

/**
 * Combina dos colecciones por uid: lo que ya está en `current` no se duplica
 * ni se pisa, y lo que figura en `deleted` no entra desde ningún lado.
 */
export function mergeCollections(current, imported, deleted = {}) {
  const merged = current.filter((it) => !deleted[it.uid])
  const seen = new Set(merged.map((it) => it.uid))
  for (const it of imported) {
    if (it.uid && (seen.has(it.uid) || deleted[it.uid])) continue
    const uid = it.uid || newUid()
    seen.add(uid)
    merged.push({ ...it, uid })
  }
  return merged
}
