/**
 * Iconos de línea, dibujados a mano en SVG.
 *
 * No se usan emoji a propósito: cada sistema operativo los dibuja distinto
 * (y a color), así que la barra se vería diferente en cada teléfono. Estos
 * son trazos que heredan el color del texto con `currentColor`, así que
 * siguen el tema y se ven idénticos en todos lados.
 */
const PATHS = {
  // flecha ← volver
  back: (
    <>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </>
  ),
  // dos cartas apiladas → la colección
  cards: (
    <>
      <rect x="8" y="3" width="12" height="16" rx="2" />
      <path d="M15 21H6a2 2 0 0 1-2-2V8" />
    </>
  ),
  // + agregar
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  // controles deslizantes → ajustes
  sliders: (
    <>
      <path d="M4 7h9" />
      <path d="M18 7h2" />
      <path d="M4 17h5" />
      <path d="M14 17h6" />
      <circle cx="15.5" cy="7" r="2.2" />
      <circle cx="11.5" cy="17" r="2.2" />
    </>
  ),
  // cruz → cerrar
  close: (
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  // chevrones ‹ › → anterior / siguiente en el modal
  prev: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  // flecha circular → actualizar precios
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <path d="M20.5 4v5h-5" />
    </>
  ),
}

export default function Icon({ name, className = '' }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
