/**
 * Persistencia de la colección en localStorage + export/import JSON.
 * (En un sitio real como GitHub Pages, localStorage persiste entre visitas
 * en el mismo navegador. El export JSON sirve de respaldo y para migrar.)
 */

const COLLECTION_KEY = 'tcgvault.collection.v1'
const SETTINGS_KEY = 'tcgvault.settings.v1'

export function loadCollection() {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY)
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveCollection(items) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(items))
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}
  } catch {
    return {}
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function newUid() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
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

/** Combina un respaldo con la colección actual (por uid: lo ya existente no se duplica ni se pisa). */
export function mergeCollections(current, imported) {
  const seen = new Set(current.map((it) => it.uid))
  const merged = [...current]
  for (const it of imported) {
    if (it.uid && seen.has(it.uid)) continue // ya está, no duplicar
    const uid = it.uid || newUid()
    seen.add(uid)
    merged.push({ ...it, uid })
  }
  return merged
}
