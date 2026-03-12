import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStreamStatus = 'idle' | 'loading' | 'ready' | 'error' | 'ended'

export function useCameraStream(enabled: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<CameraStreamStatus>('idle')
  const [retryCount, setRetryCount] = useState(0)
  const streamRef = useRef<MediaStream | null>(null)

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setStream(null)
      setError(null)
      setStatus('idle')
      return
    }

    setStatus('loading')
    setError(null)

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    }

    let removeEnded: (() => void) | null = null

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((mediaStream) => {
        streamRef.current = mediaStream
        setStream(mediaStream)
        setStatus('ready')
        setError(null)

        const videoTrack = mediaStream.getVideoTracks()[0]
        if (videoTrack) {
          const onEnded = () => {
            setStatus('ended')
            setError('Камера отключилась. Нажми «Повторить» или закрой AR.')
          }
          videoTrack.addEventListener('ended', onEnded)
          removeEnded = () => videoTrack.removeEventListener('ended', onEnded)
        }
      })
      .catch((err) => {
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Доступ к камере запрещён'
            : err?.message ?? 'Не удалось получить доступ к камере'
        setError(msg)
        setStatus('error')
        setStream(null)
      })

    return () => {
      removeEnded?.()
      const s = streamRef.current
      if (s) {
        s.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setStream(null)
      setStatus('idle')
      setError(null)
    }
  }, [enabled, retryCount])

  return { stream, error, status, retry }
}
