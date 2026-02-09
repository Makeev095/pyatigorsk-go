import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type HeadingState =
  | { status: 'idle' }
  | { status: 'unsupported' }
  | { status: 'needs_permission' }
  | { status: 'denied' }
  | { status: 'active'; headingDeg: number; accuracyDeg?: number; updatedAt: number }

function normalizeDeg(d: number) {
  const x = d % 360
  return x < 0 ? x + 360 : x
}

function shortestDeltaDeg(from: number, to: number) {
  // returns delta in (-180, 180]
  const d = normalizeDeg(to) - normalizeDeg(from)
  const wrapped = ((d + 540) % 360) - 180
  return wrapped
}

function getScreenAngleDeg() {
  // screen.orientation is not supported everywhere
  const so = (screen as any)?.orientation
  const angle =
    (typeof so?.angle === 'number' && so.angle) ||
    (typeof (window as any).orientation === 'number' && (window as any).orientation) ||
    0
  return normalizeDeg(angle)
}

export function useDeviceHeading(enabled: boolean) {
  const supported = useMemo(() => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window, [])
  const [state, setState] = useState<HeadingState>({ status: 'idle' })
  const smoothRef = useRef<number | null>(null)
  const lastAccRef = useRef<number | undefined>(undefined)

  const requestPermission = useCallback(async () => {
    if (!supported) {
      setState({ status: 'unsupported' })
      return false
    }

    const DOE: any = (window as any).DeviceOrientationEvent
    if (typeof DOE?.requestPermission !== 'function') {
      // No permission API — treat as allowed
      return true
    }

    try {
      const res = await DOE.requestPermission()
      if (res === 'granted') return true
      setState({ status: 'denied' })
      return false
    } catch {
      setState({ status: 'denied' })
      return false
    }
  }, [supported])

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' })
      return
    }
    if (!supported) {
      setState({ status: 'unsupported' })
      return
    }

    const DOE: any = (window as any).DeviceOrientationEvent
    const needsPermission = typeof DOE?.requestPermission === 'function'
    if (needsPermission) {
      // iOS: events will start only after user gesture permission
      setState((prev) => (prev.status === 'active' ? prev : { status: 'needs_permission' }))
    }

    let alive = true
    const onOrientation = (e: DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }) => {
      if (!alive) return

      // iOS: optional accuracy in degrees (lower is better)
      if (typeof e.webkitCompassAccuracy === 'number' && Number.isFinite(e.webkitCompassAccuracy)) {
        lastAccRef.current = e.webkitCompassAccuracy
      }

      // iOS Safari provides webkitCompassHeading (0..360, where 0 = north)
      if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
        const raw = normalizeDeg(e.webkitCompassHeading)
        const prev = smoothRef.current
        const next =
          prev == null ? raw : normalizeDeg(prev + shortestDeltaDeg(prev, raw) * 0.25)
        smoothRef.current = next
        setState({ status: 'active', headingDeg: next, accuracyDeg: lastAccRef.current, updatedAt: Date.now() })
        return
      }

      // Generic: alpha is 0..360 (rotation around z axis). Convert to compass heading.
      if (typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
        const screenAngle = getScreenAngleDeg()
        const heading = normalizeDeg(360 - e.alpha + screenAngle)
        const prev = smoothRef.current
        const next =
          prev == null ? heading : normalizeDeg(prev + shortestDeltaDeg(prev, heading) * 0.25)
        smoothRef.current = next
        setState({ status: 'active', headingDeg: next, accuracyDeg: lastAccRef.current, updatedAt: Date.now() })
      }
    }

    window.addEventListener('deviceorientationabsolute', onOrientation as any, true)
    window.addEventListener('deviceorientation', onOrientation as any, true)

    return () => {
      alive = false
      window.removeEventListener('deviceorientationabsolute', onOrientation as any, true)
      window.removeEventListener('deviceorientation', onOrientation as any, true)
    }
  }, [enabled, supported])

  return { state, requestPermission }
}

