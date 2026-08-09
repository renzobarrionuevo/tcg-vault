import { useEffect, useRef, useState } from 'react'
import { loadSettings, saveSettings, exportCollection, parseBackupFile, mergeCollections } from '../lib/storage.js'
import { getMeta } from '../api/tcgcsv.js'
import { fmtDate } from '../lib/helpers.js'

export default function Settings({ items, onReplaceCollection, toast }) {
  const [apiKey, setApiKey] = useState(() => loadSettings().ptcgApiKey || '')
  const [meta, setMeta] = useState(null)
  const fileRef = useRef(null)
  const importMode = useRef('merge')

  useEffect(() => {
    getMeta().then(setMeta)
  }, [])

  function saveKey() {
    saveSettings({ ...loadSettings(), ptcgApiKey: apiKey.trim() })
    toast('Clave guardada. Se usará en las próximas búsquedas de Pokémon.')
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const imported = await parseBackupFile(file)
      const next = importMode.current === 'replace' ? imported : mergeCollections(items, imported)
      onReplaceCollection(next)
      toast(`Importadas ${imported.length} cartas (${importMode.current === 'replace' ? 'reemplazo' : 'combinado'}).`)
    } catch (err) {
      toast(`No pude importar: ${err.message}`)
    }
  }

  return (
    <div className="settings">
      <section>
        <h3>Datos de precios</h3>
        <p className="hint">
          Los precios de TCGPlayer se regeneran una vez por día con GitHub Actions (tcgcsv.com).
          {meta?.updatedAt ? (
            <>
              {' '}
              Última actualización del catálogo: <strong>{fmtDate(meta.updatedAt)}</strong> · {meta.products?.toLocaleString()} productos.
            </>
          ) : (
            ' Todavía no se generaron los datos (corré el workflow o `npm run fetch-data`).'
          )}
        </p>
      </section>

      <section>
        <h3>API key de pokemontcg.io (opcional)</h3>
        <p className="hint">
          Sin clave: 1.000 consultas/día. Con clave gratuita (registro en{' '}
          <a href="https://dev.pokemontcg.io" target="_blank" rel="noreferrer">
            dev.pokemontcg.io
          </a>
          ): 20.000/día. Se guarda solo en tu navegador.
        </p>
        <div className="row">
          <input
            type="password"
            placeholder="X-Api-Key…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className="btn" onClick={saveKey}>
            Guardar
          </button>
        </div>
      </section>

      <section>
        <h3>Respaldo</h3>
        <p className="hint">
          Tu colección vive en el almacenamiento de este navegador. Exportá un respaldo cada tanto y para pasarla a
          otro dispositivo.
        </p>
        <div className="row">
          <button className="btn" onClick={() => exportCollection(items)} disabled={!items.length}>
            Exportar JSON ({items.length})
          </button>
          <button
            className="btn"
            onClick={() => {
              importMode.current = 'merge'
              fileRef.current?.click()
            }}
          >
            Importar (combinar)
          </button>
          <button
            className="btn"
            onClick={() => {
              if (!items.length || confirm('Esto reemplaza TODA tu colección actual por la del archivo. ¿Continuar?')) {
                importMode.current = 'replace'
                fileRef.current?.click()
              }
            }}
          >
            Importar (reemplazar)
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />
        </div>
      </section>

      <section>
        <h3>Zona peligrosa</h3>
        <div className="row">
          <button
            className="btn danger"
            disabled={!items.length}
            onClick={() => {
              if (confirm('¿Borrar TODA la colección? Esta acción no se puede deshacer.') && confirm('¿Seguro? Exportá un respaldo antes si tenés dudas.')) {
                onReplaceCollection([])
                toast('Colección borrada.')
              }
            }}
          >
            Borrar toda la colección
          </button>
        </div>
      </section>
    </div>
  )
}
