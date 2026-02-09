import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { Landmark, LandmarkId } from '../types'

type UserPos = { lat: number; lon: number; accuracyM?: number }

function Follow({ user, follow }: { user?: UserPos; follow: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!follow || !user) return
    map.setView([user.lat, user.lon] as [number, number], Math.max(map.getZoom(), 16), { animate: true })
  }, [follow, map, user?.lat, user?.lon])
  return null
}

function InvalidateOnTick({ tick }: { tick: number }) {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize({ animate: false })
    }, 60)
    return () => window.clearTimeout(id)
  }, [map, tick])
  return null
}

export function MapView(props: {
  user?: UserPos
  follow: boolean
  center?: { lat: number; lon: number }
  landmarks: Landmark[]
  discoveredIds: Set<LandmarkId>
  selectedId?: LandmarkId
  target?: { lat: number; lon: number }
  mapProvider?: 'osm' | 'yandex'
  yandexApiKey?: string
  navArrowDeg?: number
  invalidateTick?: number
  onSelect: (id: LandmarkId) => void
}) {
  const initialCenter = useMemo(() => {
    if (props.center) return [props.center.lat, props.center.lon] as [number, number]
    return [44.0405, 43.0825] as [number, number] // Пятигорск (примерный центр)
  }, [props.center])

  const navIcon = useMemo(() => {
    if (!props.user) return null
    if (typeof props.navArrowDeg !== 'number' || !Number.isFinite(props.navArrowDeg)) return null
    const rot = Math.round(props.navArrowDeg)
    const html = `
      <div style="transform: rotate(${rot}deg); transform-origin: 50% 50%;">
        <svg width="34" height="34" viewBox="0 0 64 64" style="display:block" shape-rendering="geometricPrecision">
          <defs>
            <linearGradient id="uG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="rgba(34,197,94,0.98)"/>
              <stop offset="1" stop-color="rgba(59,130,246,0.98)"/>
            </linearGradient>
          </defs>
          <path d="M32 6 L56 56 L32 46 L8 56 Z"
            fill="url(#uG)"
            stroke="rgba(226,232,240,0.9)"
            stroke-width="2"
            vector-effect="non-scaling-stroke"/>
          <circle cx="32" cy="48" r="3.5" fill="rgba(2,6,23,0.85)"/>
        </svg>
      </div>
    `
    return L.divIcon({
      className: 'userNavArrowIcon',
      html,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    })
  }, [props.user?.lat, props.user?.lon, props.navArrowDeg])

  return (
    <MapContainer center={initialCenter} zoom={14} zoomControl={false}>
      <InvalidateOnTick tick={props.invalidateTick ?? 0} />
      {props.mapProvider === 'yandex' && props.yandexApiKey ? (
        <TileLayer
          url={`https://tiles.api-maps.yandex.ru/v1/tiles/?l=map&x={x}&y={y}&z={z}&lang=ru_RU&apikey=${encodeURIComponent(
            props.yandexApiKey,
          )}`}
          attribution='&copy; <a href="https://yandex.com/dev/maps/">Yandex</a>'
        />
      ) : (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
      )}

      <Follow user={props.user} follow={props.follow} />

      {props.user && props.target ? (
        <Polyline
          positions={[
            [props.user.lat, props.user.lon],
            [props.target.lat, props.target.lon],
          ]}
          pathOptions={{
            color: '#60a5fa',
            weight: 3,
            opacity: 0.75,
            dashArray: '8 10',
          }}
        />
      ) : null}

      {props.user?.accuracyM ? (
        <Circle
          center={[props.user.lat, props.user.lon]}
          radius={props.user.accuracyM}
          pathOptions={{ color: '#60a5fa', opacity: 0.25, fillOpacity: 0.08 }}
        />
      ) : null}

      {props.user ? (
        <CircleMarker
          center={[props.user.lat, props.user.lon]}
          radius={9}
          pathOptions={{ color: '#93c5fd', fillColor: '#3b82f6', fillOpacity: 0.95 }}
        />
      ) : null}

      {props.user && navIcon ? (
        <Marker
          position={[props.user.lat, props.user.lon]}
          icon={navIcon}
          interactive={false}
          keyboard={false}
        />
      ) : null}

      {props.landmarks.map((lm) => {
        const discovered = props.discoveredIds.has(lm.id)
        const selected = props.selectedId === lm.id
        const color = discovered ? '#22c55e' : '#f59e0b'
        const fill = discovered ? '#22c55e' : '#fbbf24'

        return (
          <CircleMarker
            key={lm.id}
            center={[lm.lat, lm.lon]}
            radius={selected ? 10 : 8}
            pathOptions={{
              color,
              weight: selected ? 3 : 2,
              opacity: 0.9,
              fillColor: fill,
              fillOpacity: discovered ? 0.9 : 0.55,
            }}
            eventHandlers={{
              click: () => props.onSelect(lm.id),
            }}
          />
        )
      })}
    </MapContainer>
  )
}

