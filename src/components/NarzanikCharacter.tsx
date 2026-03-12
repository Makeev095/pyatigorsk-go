import { forwardRef } from 'react'

export interface NarzanikCharacterProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Нарзанник — фонтанчик с мордашкой в стиле покемона.
 * 3D-вид: тени, градиенты, объём. Стоит вертикально на земле.
 */
export const NarzanikCharacter = forwardRef<HTMLDivElement, NarzanikCharacterProps>(
  function NarzanikCharacter({ className, style }, ref) {
    return (
      <div ref={ref} className={className} style={style} aria-hidden>
        <svg
          viewBox="0 0 120 200"
          xmlns="http://www.w3.org/2000/svg"
          className="narzanikSvg"
        >
          <defs>
            <linearGradient id="stoneGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#78716c" />
              <stop offset="30%" stopColor="#a8a29e" />
              <stop offset="70%" stopColor="#d6d3d1" />
              <stop offset="100%" stopColor="#e7e5e4" />
            </linearGradient>
            <linearGradient id="stoneShadow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#57534e" />
              <stop offset="100%" stopColor="#a8a29e" />
            </linearGradient>
            <linearGradient id="waterJet" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.6" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.4" />
            </filter>
            <filter id="innerShadow">
              <feOffset dx="1" dy="1" />
              <feGaussianBlur stdDeviation="1" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Тень под фонтаном */}
          <ellipse cx="60" cy="195" rx="35" ry="8" fill="#1c1917" opacity="0.35" />
          {/* Основание фонтана (чаша) */}
          <ellipse cx="60" cy="165" rx="38" ry="12" fill="url(#stoneShadow)" />
          <path
            d="M 22 165 Q 60 145 98 165 Q 60 185 22 165"
            fill="url(#stoneGrad)"
            filter="url(#shadow)"
          />
          {/* Колонна фонтана (цилиндр, 3D) */}
          <path
            d="M 35 165 L 35 55 Q 35 35 60 35 Q 85 35 85 55 L 85 165 Z"
            fill="url(#stoneGrad)"
            filter="url(#shadow)"
          />
          <path
            d="M 60 35 Q 85 35 85 55 L 85 165 L 60 165 L 60 55 Q 60 35 60 35"
            fill="url(#stoneShadow)"
            opacity="0.4"
          />
          {/* Струя воды */}
          <path
            d="M 55 30 Q 60 0 65 30"
            fill="none"
            stroke="url(#waterJet)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <ellipse cx="60" cy="5" rx="4" ry="6" fill="rgba(125,211,252,0.8)" />
          {/* Брызги */}
          <circle cx="52" cy="18" r="2" fill="rgba(56,189,248,0.7)" />
          <circle cx="68" cy="22" r="1.5" fill="rgba(56,189,248,0.6)" />
          {/* Глаза (живые, покемон-стиль) */}
          <ellipse cx="42" cy="95" rx="10" ry="12" fill="#1e293b" />
          <ellipse cx="78" cy="95" rx="10" ry="12" fill="#1e293b" />
          <ellipse cx="44" cy="91" rx="4" ry="5" fill="white" />
          <ellipse cx="80" cy="91" rx="4" ry="5" fill="white" />
          <ellipse cx="45" cy="90" rx="1.5" ry="2" fill="#1e293b" />
          <ellipse cx="81" cy="90" rx="1.5" ry="2" fill="#1e293b" />
          {/* Улыбка */}
          <path
            d="M 38 115 Q 60 135 82 115"
            fill="none"
            stroke="#1e293b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Румянец */}
          <ellipse cx="30" cy="108" rx="8" ry="5" fill="#f472b6" opacity="0.3" />
          <ellipse cx="90" cy="108" rx="8" ry="5" fill="#f472b6" opacity="0.3" />
        </svg>
      </div>
    )
  },
)

/**
 * Рисует Нарзанника (фонтанчик) на canvas с 3D-эффектом.
 */
export function drawNarzanikOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  animationPhase: number = 0,
) {
  const scale = 1 + Math.sin(animationPhase) * 0.015
  const w = width * scale
  const h = height * scale
  const ox = x + (width - w) / 2
  const oy = y + (height - h) / 2

  ctx.save()

  const bounce = Math.sin(animationPhase * 1.5) * 2

  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 4

  // Тень
  ctx.fillStyle = 'rgba(28, 25, 23, 0.35)'
  ctx.beginPath()
  ctx.ellipse(ox + w / 2, oy + h * 0.975, w * 0.29, h * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Основание (чаша)
  const stoneGrad = ctx.createLinearGradient(ox, oy + h, ox, oy)
  stoneGrad.addColorStop(0, '#78716c')
  stoneGrad.addColorStop(0.3, '#a8a29e')
  stoneGrad.addColorStop(0.7, '#d6d3d1')
  stoneGrad.addColorStop(1, '#e7e5e4')

  ctx.fillStyle = '#57534e'
  ctx.beginPath()
  ctx.ellipse(ox + w / 2, oy + h * 0.825, w * 0.32, h * 0.06, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = stoneGrad
  ctx.beginPath()
  ctx.ellipse(ox + w / 2, oy + h * 0.82, w * 0.3, h * 0.055, 0, 0, Math.PI * 2)
  ctx.fill()

  // Колонна (цилиндр с 3D)
  ctx.fillStyle = stoneGrad
  ctx.beginPath()
  ctx.moveTo(ox + w * 0.29, oy + h * 0.825)
  ctx.lineTo(ox + w * 0.29, oy + h * 0.275)
  ctx.quadraticCurveTo(ox + w * 0.29, oy + h * 0.175, ox + w / 2, oy + h * 0.175)
  ctx.quadraticCurveTo(ox + w * 0.71, oy + h * 0.175, ox + w * 0.71, oy + h * 0.275)
  ctx.lineTo(ox + w * 0.71, oy + h * 0.825)
  ctx.closePath()
  ctx.fill()

  const shadowGrad = ctx.createLinearGradient(ox, oy, ox + w, oy)
  shadowGrad.addColorStop(0, 'rgba(87, 83, 78, 0.5)')
  shadowGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = shadowGrad
  ctx.beginPath()
  ctx.moveTo(ox + w / 2, oy + h * 0.175)
  ctx.lineTo(ox + w * 0.71, oy + h * 0.275)
  ctx.lineTo(ox + w * 0.71, oy + h * 0.825)
  ctx.lineTo(ox + w / 2, oy + h * 0.825)
  ctx.closePath()
  ctx.fill()

  // Струя воды
  const waterGrad = ctx.createLinearGradient(ox + w / 2, oy + h, ox + w / 2, oy)
  waterGrad.addColorStop(0, 'rgba(14, 165, 233, 0.9)')
  waterGrad.addColorStop(1, 'rgba(125, 211, 252, 0.6)')
  ctx.strokeStyle = waterGrad
  ctx.lineWidth = w * 0.065
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ox + w * 0.46, oy + h * 0.15 + bounce)
  ctx.quadraticCurveTo(ox + w / 2, oy + h * 0.02, ox + w * 0.54, oy + h * 0.15 + bounce)
  ctx.stroke()

  ctx.fillStyle = 'rgba(125, 211, 252, 0.8)'
  ctx.beginPath()
  ctx.ellipse(ox + w / 2, oy + h * 0.025 + bounce * 0.5, w * 0.033, h * 0.03, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(56, 189, 248, 0.7)'
  ctx.beginPath()
  ctx.arc(ox + w * 0.43, oy + h * 0.09, w * 0.017, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ox + w * 0.57, oy + h * 0.11, w * 0.012, 0, Math.PI * 2)
  ctx.fill()

  // Глаза
  const eyeSize = w * 0.083
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.35, oy + h * 0.475, eyeSize, eyeSize * 1.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.65, oy + h * 0.475, eyeSize, eyeSize * 1.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.37, oy + h * 0.455, eyeSize * 0.4, eyeSize * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.67, oy + h * 0.455, eyeSize * 0.4, eyeSize * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.375, oy + h * 0.45, eyeSize * 0.15, eyeSize * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.675, oy + h * 0.45, eyeSize * 0.15, eyeSize * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Улыбка
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = w * 0.02
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ox + w * 0.32, oy + h * 0.575)
  ctx.quadraticCurveTo(ox + w / 2, oy + h * 0.675, ox + w * 0.68, oy + h * 0.575)
  ctx.stroke()

  // Румянец
  ctx.fillStyle = 'rgba(244, 114, 182, 0.3)'
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.25, oy + h * 0.54, w * 0.067, h * 0.025, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(ox + w * 0.75, oy + h * 0.54, w * 0.067, h * 0.025, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}
