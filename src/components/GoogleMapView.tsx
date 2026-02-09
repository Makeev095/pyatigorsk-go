import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useMemo, useRef } from 'react'
import type { Landmark, LandmarkId } from '../types'

type UserPos = { lat: number; lon: number; accuracyM?: number }

function toLatLngLiteral(p: { lat: number; lon: number }): google.maps.LatLngLiteral {
  return { lat: p.lat, lng: p.lon }
}

export function GoogleMapView(props: {
  apiKey: string
  user?: UserPos
  follow: boolean
  center?: { lat: number; lon: number }
  landmarks: Landmark[]
  discoveredIds: Set<LandmarkId>
  selectedId?: LandmarkId
  target?: { lat: number; lon: number }
  navArrowDeg?: number
  onSelect: (id: LandmarkId) => void
}) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const gRef = useRef<typeof google | null>(null)

  const markersRef = useRef<Map<LandmarkId, google.maps.Marker>>(new Map())
  const userMarkerRef = useRef<google.maps.Marker | null>(null)
  const userArrowRef = useRef<google.maps.Marker | null>(null)
  const accCircleRef = useRef<google.maps.Circle | null>(null)
  const lineRef = useRef<google.maps.Polyline | null>(null)

  const initialCenter = useMemo(() => {
    if (props.center) return { lat: props.center.lat, lng: props.center.lon }
    return { lat: 44.0405, lng: 43.0825 }
  }, [props.center])

  useEffect(() => {
    let cancelled = false
    setOptions({
      key: props.apiKey,
      v: 'weekly',
      language: 'ru',
      region: 'RU',
    })

    ;(async () => {
      try {
        const { Map } = await importLibrary('maps')
        await importLibrary('marker')
        if (cancelled) return
        gRef.current = google
        if (!divRef.current) return

        const map = new Map(divRef.current, {
          center: initialCenter,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          backgroundColor: '#0b1220',
        })
        mapRef.current = map
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [props.apiKey, initialCenter.lat, initialCenter.lng])

  // Landmarks markers
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (!g || !map) return

    // create/update markers
    for (const lm of props.landmarks) {
      const existing = markersRef.current.get(lm.id)
      const discovered = props.discoveredIds.has(lm.id)
      const selected = props.selectedId === lm.id
      const stroke = discovered ? '#16a34a' : '#f59e0b'
      const fill = discovered ? '#22c55e' : '#fbbf24'

      const icon: google.maps.Symbol = {
        path: g.maps.SymbolPath.CIRCLE,
        fillColor: fill,
        fillOpacity: discovered ? 0.95 : 0.6,
        strokeColor: stroke,
        strokeOpacity: 0.95,
        strokeWeight: selected ? 3 : 2,
        scale: selected ? 7 : 6,
      }

      if (!existing) {
        const m = new g.maps.Marker({
          position: toLatLngLiteral(lm),
          map,
          icon,
          title: lm.name,
        })
        m.addListener('click', () => props.onSelect(lm.id))
        markersRef.current.set(lm.id, m)
      } else {
        existing.setIcon(icon)
        existing.setPosition(toLatLngLiteral(lm))
      }
    }

    // remove stale markers
    for (const [id, m] of markersRef.current.entries()) {
      if (!props.landmarks.find((x) => x.id === id)) {
        m.setMap(null)
        markersRef.current.delete(id)
      }
    }
  }, [props.landmarks, props.discoveredIds, props.selectedId, props.onSelect])

  // User marker + accuracy + arrow
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (!g || !map) return

    if (!props.user) {
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      userArrowRef.current?.setMap(null)
      userArrowRef.current = null
      accCircleRef.current?.setMap(null)
      accCircleRef.current = null
      return
    }

    const pos = { lat: props.user.lat, lng: props.user.lon }

    if (!userMarkerRef.current) {
      userMarkerRef.current = new g.maps.Marker({
        position: pos,
        map,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: '#3b82f6',
          fillOpacity: 0.95,
          strokeColor: '#93c5fd',
          strokeOpacity: 0.95,
          strokeWeight: 2,
          scale: 6,
        },
        zIndex: 999,
      })
    } else {
      userMarkerRef.current.setPosition(pos)
    }

    const accuracy = props.user.accuracyM
    if (accuracy && Number.isFinite(accuracy)) {
      if (!accCircleRef.current) {
        accCircleRef.current = new g.maps.Circle({
          map,
          center: pos,
          radius: accuracy,
          strokeColor: '#60a5fa',
          strokeOpacity: 0.25,
          strokeWeight: 1,
          fillColor: '#60a5fa',
          fillOpacity: 0.08,
        })
      } else {
        accCircleRef.current.setCenter(pos)
        accCircleRef.current.setRadius(accuracy)
      }
    } else if (accCircleRef.current) {
      accCircleRef.current.setMap(null)
      accCircleRef.current = null
    }

    if (typeof props.navArrowDeg === 'number' && Number.isFinite(props.navArrowDeg)) {
      const arrow: google.maps.Symbol = {
        path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        fillColor: '#e2e8f0',
        fillOpacity: 0.95,
        strokeColor: '#0b1220',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        rotation: props.navArrowDeg,
        scale: 4.5,
      }
      if (!userArrowRef.current) {
        userArrowRef.current = new g.maps.Marker({
          position: pos,
          map,
          icon: arrow,
          zIndex: 1000,
        })
      } else {
        userArrowRef.current.setPosition(pos)
        userArrowRef.current.setIcon(arrow)
      }
    } else if (userArrowRef.current) {
      userArrowRef.current.setMap(null)
      userArrowRef.current = null
    }

    if (props.follow) {
      map.panTo(pos)
    }
  }, [props.user?.lat, props.user?.lon, props.user?.accuracyM, props.follow, props.navArrowDeg])

  // Target line
  useEffect(() => {
    const g = gRef.current
    const map = mapRef.current
    if (!g || !map) return

    if (!props.user || !props.target) {
      lineRef.current?.setMap(null)
      lineRef.current = null
      return
    }

    const path = [
      { lat: props.user.lat, lng: props.user.lon },
      { lat: props.target.lat, lng: props.target.lon },
    ]

    if (!lineRef.current) {
      lineRef.current = new g.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: '#60a5fa',
        strokeOpacity: 0.75,
        strokeWeight: 3,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
            offset: '0',
            repeat: '16px',
          },
        ],
      })
    } else {
      lineRef.current.setPath(path)
    }
  }, [props.user?.lat, props.user?.lon, props.target?.lat, props.target?.lon])

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />
}

