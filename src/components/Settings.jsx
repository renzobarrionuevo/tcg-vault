import { useEffect, useRef, useState } from 'react'
import { loadSettings, saveSettings, exportCollection, parseBackupFile, mergeCollections } from '../lib/storage.js'
import { getMeta } from '../api/tcgcsv.js'
import { fmtDate } from '../lib/helpers.js'
import { syncEnabled } from '../api/sync.js'

export default function Settings({ items, deleted, onReplaceCollection, toast }) {
  const [apiKey, setApiKey] = useState(() => loadSettings().ptcgApiKey || '')
  const [meta, setMeta] = useState(null)
  const fileRef = useRef(null)
  const importMode = useRef('merge')

  useEffect(() => {
    getMeta().then(setMeta)
  }, [])

  function saveKey() {
    saveSettings({ ...loadSettings(), ptcgApiKey: apiKey.trim() })
    toast('Clave guardada. Se usará en las próximas consultas a pokemontcg.io.')
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const imported = await parseBackupFile(file)
      if (importMode.current === 'replace') {
        // el archivo manda: entra todo, incluso lo que se hubiera borrado
        onReplaceCollection(imported, { restore: true })
        toast(`Colección reemplazada por la del archivo (${imported.length} cartas).`)
      } else {
        const next = mergeCollections(items, imported, deleted)
        const added = next.length - items.length
        const skipped = imported.length - added
        onReplaceCollection(next)
        toast(
          skipped
            ? `Combinado: ${added} cartas nuevas (${skipped} ya estaban o las habías borrado).`
            : `Combinado: ${added} cartas nuevas.`
        )
      }
    } catch (err) {
      toast(`No pude importar: ${err.message}`)
    }
  }

  return (
    <div className="settings">
      <section>
        <h3>Datos de precios</h3>
        <p className="hint">
          Los precios de TCGPlayer se regeneran una vez por día con GitHub Actions (tcgcsv.com) y la app los aplica sola
          al abrirse.
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
          Las búsquedas por nombre y los precios ya no dependen de pokemontcg.io. La API solo se usa para buscar por su
          código (<code>sv4-123</code>) y para actualizar cartas agregadas con versiones anteriores de la app. Sin clave:
          1.000 consultas/día. Con clave gratuita (registro en{' '}
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
        <h3>Sincronización entre dispositivos</h3>
        {syncEnabled ? (
          <p className="hint">
            Firebase está configurado ✓ — usá el botón <strong>«Entrar con Google»</strong> (arriba) en cada
            dispositivo y tu colección se mantiene sincronizada sola. Lo que borrás en un dispositivo se borra en todos.
          </p>
        ) : (
          <p className="hint">
            Desactivada. Para activarla, creá un proyecto gratuito en Firebase y pegá su configuración en el archivo{' '}
            <code>src/firebase-config.js</code> del repositorio (las instrucciones están dentro del archivo y en el
            README). Mientras tanto, tu colección vive solo en este navegador.
          </p>
        )}
      </section>

      <section>
        <h3>Respaldo</h3>
        <p className="hint">
          Exportá un respaldo cada tanto. «Combinar» agrega lo que falte del archivo sin volver a traer lo que
          borraste; «Reemplazar» deja la colección exactamente como está en el archivo.
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
