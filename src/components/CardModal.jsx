import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { GAME_LABEL, largeImage } from '../lib/helpers.js'

/**
 * Carta en grande, centrada, sobre un fondo oscuro. Recibe la lista en la
 * que está la carta y su posición, así las flechas de los costados (o ← →)
 * pasan a la anterior / siguiente. Se cierra con la X, con Escape o tocando
 * afuera.
 */
export default function CardModal({ cards, index, onIndexChange, onClose, onShowHistory }) {
  const card = cards[index]
  const hasPrev = index > 0
  const hasNext = index < cards.length - 1

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1)
      else if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, hasPrev, hasNext, onIndexChange, onClose])

  // que no scrollee la página de fondo mientras está abierto
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // las vecinas se van bajando de antemano para que el cambio sea instantáneo
  useEffect(() => {
    for (const c of [cards[index - 1], cards[index + 1]]) {
      const src = c && largeImage(c.img)
      if (src) new Image().src = src
    }
  }, [cards, index])

  if (!card) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={card.name} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} title="Cerrar" aria-label="Cerrar">
          <Icon name="close" />
        </button>
        {hasPrev && (
          <button className="modal-nav prev" onClick={() => onIndexChange(index - 1)} title="Anterior" aria-label="Anterior">
            <Icon name="prev" />
          </button>
        )}
        {hasNext && (
          <button className="modal-nav next" onClick={() => onIndexChange(index + 1)} title="Siguiente" aria-label="Siguiente">
            <Icon name="next" />
          </button>
        )}
        {/* key: al cambiar de carta la imagen arranca de cero (y su fallback también) */}
        <ModalImage key={`${card.source}-${card.sourceId}-${card.uid || ''}`} card={card} />
        <div className="modal-caption">
          <strong>{card.name}</strong>
          <span>
            {GAME_LABEL[card.game]} · {card.set}
            {card.num ? ` · ${card.num}` : ''}
            {card.rarity ? ` · ${card.rarity}` : ''}
          </span>
          <span className="modal-links">
            {card.url && (
              <a href={card.url} target="_blank" rel="noreferrer" className="ext-link">
                Ver en TCGPlayer ↗
              </a>
            )}
            {onShowHistory && (
              <button type="button" className="link-btn" onClick={() => onShowHistory(card)}>
                <Icon name="chart" /> Evolución de precio
              </button>
            )}
          </span>
          {cards.length > 1 && (
            <span className="modal-count">
              {index + 1} / {cards.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Marco de tamaño fijo con la proporción de una carta (63 × 88 mm): la imagen
 * se ajusta adentro, así todas abren del mismo tamaño aunque el CDN las
 * sirva en resoluciones distintas. Prueba primero la imagen grande; si no
 * existe, cae a la miniatura guardada.
 */
function ModalImage({ card }) {
  const [src, setSrc] = useState(() => largeImage(card.img))
  return (
    <div className="modal-figure">
      {src ? (
        <img src={src} alt={card.name} onError={() => src !== card.img && setSrc(card.img)} />
      ) : (
        <div className="noimg">Sin imagen</div>
      )}
    </div>
  )
}
