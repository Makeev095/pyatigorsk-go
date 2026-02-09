import type { PlayerProgress } from '../types'

const KEY = 'pyatigorsk-go.progress.v1'

export const DEFAULT_PROGRESS: PlayerProgress = {
  discovered: {},
  xp: 0,
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PROGRESS
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PROGRESS

    const p = parsed as Partial<PlayerProgress>
    return {
      discovered:
        p.discovered && typeof p.discovered === 'object' ? (p.discovered as any) : {},
      xp: typeof p.xp === 'number' && Number.isFinite(p.xp) ? p.xp : 0,
    }
  } catch {
    return DEFAULT_PROGRESS
  }
}

export function saveProgress(progress: PlayerProgress) {
  localStorage.setItem(KEY, JSON.stringify(progress))
}

export function resetProgress() {
  localStorage.removeItem(KEY)
}

