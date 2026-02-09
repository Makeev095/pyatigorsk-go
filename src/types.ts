export type LandmarkId = string

export type Landmark = {
  id: LandmarkId
  name: string
  description: string
  lat: number
  lon: number
  radiusM: number
  xp: number
  source?: string
}

export type PlayerProgress = {
  discovered: Record<LandmarkId, { discoveredAt: number }>
  xp: number
}

