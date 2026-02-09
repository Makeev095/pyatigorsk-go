import { formatDistance } from '../lib/geo'

function normalizeDeg(d: number) {
  const x = d % 360
  return x < 0 ? x + 360 : x
}

export function NavigationHUD(props: {
  visible: boolean
  active: boolean
  targetName: string
  distanceM: number
  relativeDeg?: number
  headingMode: 'compass' | 'gps' | 'none'
  calibrationHint?: string | null
  variant?: 'sheet' | 'floating'
  onStart: () => void
  onStop: () => void
}) {
  if (!props.visible) return null

  const rot =
    typeof props.relativeDeg === 'number' && Number.isFinite(props.relativeDeg)
      ? Math.round(normalizeDeg(props.relativeDeg))
      : 0

  return (
    <div
      className={`navHud ${props.variant === 'floating' ? 'navHudFloating' : 'navHudSheet'}`}
      aria-label="Навигация"
    >
      <div className="navCard">
        <div className="navTopRow">
          <div className="navTitle">
            {props.active ? 'Маршрут' : 'Цель'} • <strong>{props.targetName}</strong>
          </div>
          <div className="navActions">
            {props.active ? (
              <button className="btn" onClick={props.onStop}>
                Стоп
              </button>
            ) : (
              <button className="btn btnPrimary" onClick={props.onStart}>
                Начать
              </button>
            )}
          </div>
        </div>

        <div className="navMainRow">
          <div className="navArrowWrap" aria-hidden>
            <svg
              className="navArrowSvg"
              width="34"
              height="34"
              viewBox="0 0 64 64"
              style={{ transform: `rotate(${rot}deg)` }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="navArrowG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="rgba(34,197,94,0.95)" />
                  <stop offset="1" stopColor="rgba(59,130,246,0.95)" />
                </linearGradient>
              </defs>
              <path
                d="M32 6 L56 56 L32 46 L8 56 Z"
                fill="url(#navArrowG)"
                stroke="rgba(226,232,240,0.85)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                shapeRendering="geometricPrecision"
              />
              <circle cx="32" cy="48" r="3.5" fill="rgba(2,6,23,0.85)" />
            </svg>
          </div>
          <div className="navMeta">
            <div className="navDistance">
              ~<strong>{formatDistance(props.distanceM)}</strong>
            </div>
            <div className="navMode">
              {props.headingMode === 'compass'
                ? 'Компас'
                : props.headingMode === 'gps'
                  ? 'GPS‑курс'
                  : 'Без курса'}
            </div>
          </div>
        </div>

        {props.calibrationHint ? (
          <div className="navHint" role="note">
            {props.calibrationHint}
          </div>
        ) : null}
      </div>
    </div>
  )
}

