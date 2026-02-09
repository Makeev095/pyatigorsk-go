import { formatDistance } from '../lib/geo'

function normalizeDeg(d: number) {
  const x = d % 360
  return x < 0 ? x + 360 : x
}

export function CompassHUD(props: {
  visible: boolean
  targetName: string
  distanceM: number
  relativeDeg: number
  headingAvailable: boolean
}) {
  if (!props.visible) return null
  const rot = Math.round(normalizeDeg(props.relativeDeg))

  return (
    <div className="compassHud" aria-label="Навигация к цели">
      <div className="compassCard">
        <div className="compassArrowWrap" aria-hidden>
          <div className="compassArrow" style={{ transform: `rotate(${rot}deg)` }}>
            ▲
          </div>
        </div>
        <div className="compassText">
          <div className="compassTitle">{props.targetName}</div>
          <div className="compassMeta">
            {props.headingAvailable ? 'Направление' : 'Направление (без компаса)'} •{' '}
            <strong>~{formatDistance(props.distanceM)}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

