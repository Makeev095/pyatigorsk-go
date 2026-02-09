import { useEffect, useMemo, useRef, useState } from 'react'

export type GeoState =
  | { status: 'idle' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string }
  | {
      status: 'watching'
      lat: number
      lon: number
      accuracyM?: number
      heading?: number | null
      speed?: number | null
      updatedAt: number
    }

export function useGeolocation(enabled: boolean) {
  const [state, setState] = useState<GeoState>({ status: 'idle' })
  const watchIdRef = useRef<number | null>(null)

  const supported = useMemo(() => typeof navigator !== 'undefined' && !!navigator.geolocation, [])

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setState({ status: 'idle' })
      return
    }

    if (!supported) {
      setState({ status: 'unsupported' })
      return
    }

    setState((prev) => (prev.status === 'watching' ? prev : { status: 'idle' }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: 'watching',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          updatedAt: Date.now(),
        })
      },
      (err) => {
        setState({ status: 'error', message: err.message || 'Ошибка геолокации' })
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    )

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled, supported])

  return state
}

