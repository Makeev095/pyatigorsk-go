export function CalibrationPrompt(props: {
  visible: boolean
  title?: string
  message: string
  onDismiss?: () => void
}) {
  if (!props.visible) return null

  return (
    <div className="calibrationOverlay" role="dialog" aria-label="Калибровка компаса">
      <div className="calibrationCard">
        <div className="calibrationTitle">{props.title ?? 'Калибровка компаса'}</div>
        <div className="calibrationText">{props.message}</div>
        {props.onDismiss ? (
          <div className="calibrationActions">
            <button className="btn" onClick={props.onDismiss}>
              Понятно
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

