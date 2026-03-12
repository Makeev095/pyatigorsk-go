import { useCallback, useEffect, useRef, useState } from 'react'
import { bearingDeg, distanceM, shortestDeltaDeg } from '../lib/geo'
import { capturePhoto } from '../lib/capturePhoto'
import { useCameraStream } from '../hooks/useCameraStream'
import { drawNarzanikOnCanvas } from './NarzanikCharacter'
import type { Landmark } from '../types'

/** Угол обзора камеры по горизонтали (градусы) */
const CAMERA_FOV_DEG = 60

export interface ARCameraViewProps {
  landmark: Landmark
  user: { lat: number; lon: number; accuracyM?: number } | undefined
  headingDeg: number | undefined
  accuracyBoostM: number
  onCapture: (landmark: Landmark) => void
  onClose: () => void
  showToast: (msg: string) => void
}

/**
 * Позиция Нарзанника на экране в зависимости от направления камеры.
 * Персонаж «стоит» на точке достопримечательности — виден только когда камера
 * направлена в её сторону. При повороте в другую сторону исчезает.
 * @returns rect или null, если персонаж вне поля зрения
 */
function getNarzanikRect(
  canvasWidth: number,
  canvasHeight: number,
  headingDeg: number | undefined,
  user: { lat: number; lon: number } | undefined,
  landmark: Landmark,
): { x: number; y: number; width: number; height: number } | null {
  if (!user || headingDeg === undefined) {
    return null
  }
  const bearing = bearingDeg(user, landmark)
  const relativeAngle = shortestDeltaDeg(headingDeg, bearing)
  const halfFov = CAMERA_FOV_DEG / 2
  if (Math.abs(relativeAngle) > halfFov) {
    return null
  }
  const width = canvasWidth * 0.32
  const height = width * (200 / 120)
  const y = canvasHeight - height - canvasHeight * 0.05
  const centerX = (canvasWidth - width) / 2
  const maxOffset = canvasWidth * 0.3
  const x = centerX + (relativeAngle / halfFov) * maxOffset
  return { x, y, width, height }
}

export function ARCameraView({
  landmark,
  user,
  headingDeg,
  accuracyBoostM,
  onCapture,
  onClose,
  showToast,
}: ARCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationPhaseRef = useRef(0)
  const [capturing, setCapturing] = useState(false)
  const propsRef = useRef({ headingDeg, user, landmark })
  propsRef.current = { headingDeg, user, landmark }

  const { stream, status, error, retry } = useCameraStream(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
  }, [stream])

  const drawFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height
    ctx.drawImage(video, 0, 0, cw, ch)
    const { headingDeg: h, user: u, landmark: lm } = propsRef.current
    const rect = getNarzanikRect(cw, ch, h, u, lm)
    animationPhaseRef.current += 0.08
    if (rect) {
      drawNarzanikOnCanvas(
        ctx,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        animationPhaseRef.current,
      )
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !stream) return

    const resize = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return
      canvas.width = vw
      canvas.height = vh
    }

    const onLoadedMetadata = () => {
      resize()
      drawFrame()
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    if (video.videoWidth) resize()

    let rafId: number
    const loop = () => {
      drawFrame()
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      cancelAnimationFrame(rafId)
    }
  }, [stream, drawFrame])

  const handleCapture = useCallback(async () => {
    if (capturing) return

    if (!user) {
      showToast('Включи геолокацию для съёмки')
      return
    }

    const distM = distanceM(user, landmark)
    const maxDist = landmark.radiusM + accuracyBoostM
    if (distM > maxDist) {
      showToast(`Подойди ближе к точке: нужно ≤ ${Math.round(maxDist)} м`)
      return
    }

    if (headingDeg === undefined) {
      showToast('Поверни телефон в сторону точки и разреши доступ к компасу')
      return
    }

    const video = videoRef.current
    if (!video || video.readyState < 2) {
      showToast('Камера ещё не готова')
      return
    }

    const vw = video.videoWidth
    const vh = video.videoHeight
    const rect = getNarzanikRect(vw, vh, headingDeg, user, landmark)
    if (!rect) {
      showToast('Поверни камеру в сторону достопримечательности — Нарзанник должен быть в кадре')
      return
    }

    setCapturing(true)
    try {
      await capturePhoto(video, (ctx) => {
        drawNarzanikOnCanvas(
          ctx,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          animationPhaseRef.current,
        )
      })

      onCapture(landmark)
    } catch (err) {
      showToast('Не удалось сделать снимок')
    } finally {
      setCapturing(false)
    }
  }, [user, landmark, headingDeg, accuracyBoostM, capturing, onCapture, showToast])

  if (status === 'error' || status === 'ended') {
    return (
      <div className="arCameraView arCameraViewError">
        <div className="arCameraErrorCard">
          <div className="arCameraErrorTitle">
            {status === 'ended' ? 'Камера отключилась' : 'Ошибка камеры'}
          </div>
          <div className="arCameraErrorText">{error ?? 'Не удалось получить доступ'}</div>
          <div className="arCameraErrorActions">
            <button className="btn btnPrimary" onClick={retry}>
              Повторить
            </button>
            <button className="btn" onClick={onClose}>
              Назад
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="arCameraView arCameraViewLoading">
        <div className="arCameraLoadingText">Загрузка камеры…</div>
        <button className="btn" onClick={onClose}>
          Отмена
        </button>
      </div>
    )
  }

  return (
    <div className="arCameraView">
      <video
        ref={videoRef}
        className="arCameraVideo"
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="arCameraCanvas" />
      <div className="arCameraControls">
        <button
          className="btn arCameraBtnBack"
          onClick={onClose}
          type="button"
          aria-label="Назад"
        >
          Назад
        </button>
        <button
          className="btn btnPrimary arCameraBtnCapture"
          onClick={handleCapture}
          disabled={!user || headingDeg === undefined || capturing}
          type="button"
          aria-label="Сфотографировать"
        >
          {capturing ? '…' : 'Сфотографировать'}
        </button>
      </div>
      <div className="arCameraHint">
        {landmark.name} • Поверни камеру в сторону точки — Нарзанник появится, когда будешь смотреть на неё
      </div>
    </div>
  )
}
