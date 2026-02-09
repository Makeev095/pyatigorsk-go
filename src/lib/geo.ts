const R = 6371_000 // meters

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number) {
  return (rad * 180) / Math.PI
}

export function distanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * (sinDLon * sinDLon)

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(m: number) {
  if (!Number.isFinite(m)) return '—'
  if (m < 1000) return `${Math.round(m)} м`
  return `${(m / 1000).toFixed(2)} км`
}

export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  // 0° = north, 90° = east
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  const brng = toDeg(Math.atan2(y, x))
  return (brng + 360) % 360
}

