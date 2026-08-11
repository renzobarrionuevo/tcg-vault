import { totals, fmtMoney, GAME_LABEL } from '../lib/helpers.js'

/** Los dos juegos, en el orden en que se muestran los banners.
 *  La imagen de fondo de cada uno se define en styles.css (--game-img). */
const GAMES = ['pk', 'op']

/** Pantalla de inicio: un banner por juego, con el resumen de esa colección. */
export default function GamePicker({ items, onPick }) {
  return (
    <div className="game-picker">
      <h2>Elegí una colección</h2>

      <div className="game-banners">
        {GAMES.map((g) => {
          const t = totals(items.filter((it) => it.game === g))
          return (
            <button key={g} type="button" className={`game-banner ${g}`} onClick={() => onPick(g)}>
              <span className="gb-body">
                <strong className="gb-name">{GAME_LABEL[g]}</strong>
                <span className="gb-stats">
                  {t.cards ? (
                    <>
                      {t.cards.toLocaleString()} {t.cards === 1 ? 'carta' : 'cartas'} · <b>{fmtMoney(t.value)}</b>
                    </>
                  ) : (
                    'Colección vacía'
                  )}
                </span>
              </span>
              <span className="gb-go" aria-hidden="true">
                →
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
