import { useEffect, useMemo, useRef, useState } from 'react'
import { LANDMARKS } from './data/landmarks'
import { MapView } from './components/MapView'
import { NavigationHUD } from './components/NavigationHUD'
import { CalibrationPrompt } from './components/CalibrationPrompt'
import { ARCameraView } from './components/ARCameraView'
import { useGeolocation } from './hooks/useGeolocation'
import { useDeviceHeading } from './hooks/useDeviceHeading'
import { bearingDeg, distanceM, formatDistance } from './lib/geo'
import { loadProgress, resetProgress, saveProgress } from './lib/storage'
import type { Landmark, LandmarkId, PlayerProgress } from './types'

function normalizeDeg(d: number) {
  const x = d % 360
  return x < 0 ? x + 360 : x
}

function shortestDeltaDeg(from: number, to: number) {
  const d = normalizeDeg(to) - normalizeDeg(from)
  return ((d + 540) % 360) - 180
}

type Tab = 'map' | 'collection'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function levelFromXp(xp: number) {
  // простая кривая: каждый уровень +250xp
  const level = Math.floor(xp / 250) + 1
  const nextAt = level * 250
  const prevAt = (level - 1) * 250
  const progress = prevAt === nextAt ? 0 : (xp - prevAt) / (nextAt - prevAt)
  return { level, nextAt, prevAt, progress: clamp(progress, 0, 1) }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  const geo = useGeolocation(true)
  const deviceHeading = useDeviceHeading(true)

  const [selectedId, setSelectedId] = useState<LandmarkId | undefined>(LANDMARKS[0]?.id)
  const SHEET_PEEK_PX = 64
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [sheetMaxTranslate, setSheetMaxTranslate] = useState(0)
  const [sheetMode, setSheetMode] = useState<'expanded' | 'collapsed'>('expanded')
  const [sheetTranslate, setSheetTranslate] = useState(0)
  const [sheetDragging, setSheetDragging] = useState(false)
  const sheetCollapsed = sheetMode === 'collapsed'
  const [mapInvalidateTick, setMapInvalidateTick] = useState(0)
  const dragRef = useRef<{
    startY: number
    startTranslate: number
    startAt: number
    pointerId: number
  } | null>(null)
  const [navTargetId, setNavTargetId] = useState<LandmarkId | null>(null)
  const [arMode, setArMode] = useState<{ landmark: Landmark } | null>(null)

  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress())
  const discoveredIds = useMemo(
    () => new Set(Object.keys(progress.discovered) as LandmarkId[]),
    [progress.discovered],
  )

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const headingSamplesRef = useRef<Array<{ h: number; t: number }>>([])
  const [compassJitterDeg, setCompassJitterDeg] = useState<number | null>(null)
  const lastTrackPosRef = useRef<{ lat: number; lon: number } | null>(null)
  const trackCourseRef = useRef<number | null>(null)
  const [trackCourseDeg, setTrackCourseDeg] = useState<number | null>(null)

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const mapProvider: 'osm' | 'yandex' = 'osm'

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    const el = sheetRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      const maxT = Math.max(0, Math.round(h - SHEET_PEEK_PX))
      setSheetMaxTranslate(maxT)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [SHEET_PEEK_PX])

  // В раскрытом режиме хотим почти полный экран (зазор сверху регулируется CSS через `top`)
  const sheetExpandedTranslate = useMemo(() => 0, [])

  useEffect(() => {
    if (sheetDragging) return
    setSheetTranslate(sheetMode === 'collapsed' ? sheetMaxTranslate : sheetExpandedTranslate)
  }, [sheetMode, sheetMaxTranslate, sheetDragging])

  useEffect(() => {
    // иногда WebView/браузер не дорисовывает тайлы под оверлеем до invalidateSize()
    setMapInvalidateTick((t) => t + 1)
  }, [sheetMode, sheetDragging])

  function expandSheet() {
    setSheetMode('expanded')
  }
  function collapseSheet() {
    setSheetMode('collapsed')
  }

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault?.()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  const user =
    geo.status === 'watching'
      ? {
          lat: geo.lat,
          lon: geo.lon,
          accuracyM: geo.accuracyM,
          heading: geo.heading ?? null,
          speed: geo.speed ?? null,
        }
      : undefined

  // Автоцентрирование карты только во время активного маршрута
  const followMe = navTargetId != null

  const landmarksWithDistance = useMemo(() => {
    return LANDMARKS.map((lm) => ({
      lm,
      distM: user ? distanceM(user, lm) : Number.POSITIVE_INFINITY,
    })).sort((a, b) => a.distM - b.distM)
  }, [user?.lat, user?.lon])

  const selected = useMemo(() => {
    const id = selectedId
    if (!id) return undefined
    return LANDMARKS.find((l) => l.id === id)
  }, [selectedId])

  const navTarget = useMemo(() => {
    if (!navTargetId) return undefined
    return LANDMARKS.find((l) => l.id === navTargetId)
  }, [navTargetId])

  const activeTarget = navTarget ?? selected

  const activeTargetDistM = useMemo(() => {
    if (!user || !activeTarget) return Number.POSITIVE_INFINITY
    return distanceM(user, activeTarget)
  }, [user?.lat, user?.lon, activeTarget?.id])

  const activeTargetBearing = useMemo(() => {
    if (!user || !activeTarget) return undefined
    return bearingDeg(user, activeTarget)
  }, [user?.lat, user?.lon, activeTarget?.id])

  useEffect(() => {
    if (!user) {
      lastTrackPosRef.current = null
      trackCourseRef.current = null
      setTrackCourseDeg(null)
      return
    }
    const prev = lastTrackPosRef.current
    lastTrackPosRef.current = { lat: user.lat, lon: user.lon }
    if (!prev) return

    const movedM = distanceM(prev, user)
    if (!Number.isFinite(movedM) || movedM < 4) return

    const raw = bearingDeg(prev, user)
    const prevCourse = trackCourseRef.current
    const next =
      prevCourse == null ? raw : normalizeDeg(prevCourse + shortestDeltaDeg(prevCourse, raw) * 0.25)
    trackCourseRef.current = next
    setTrackCourseDeg(next)
  }, [user?.lat, user?.lon])

  const headingDeg = useMemo(() => {
    // 1) Compass / device orientation (лучше всего для поворота на месте)
    if (deviceHeading.state.status === 'active') return deviceHeading.state.headingDeg
    // 2) GPS heading (обычно работает только при движении)
    if (user?.heading != null && Number.isFinite(user.heading) && (user.speed ?? 0) > 0.6) {
      return user.heading as number
    }
    // 3) Курс по треку (если браузер не отдаёт heading)
    if (typeof trackCourseDeg === 'number' && Number.isFinite(trackCourseDeg)) return trackCourseDeg
    return undefined
  }, [deviceHeading.state.status, deviceHeading.state.status === 'active' ? deviceHeading.state.headingDeg : 0, user?.heading, user?.speed, trackCourseDeg])

  const relativeDeg = useMemo(() => {
    if (typeof activeTargetBearing !== 'number') return undefined
    if (typeof headingDeg !== 'number') return activeTargetBearing
    return (activeTargetBearing - headingDeg + 360) % 360
  }, [activeTargetBearing, headingDeg])

  useEffect(() => {
    if (deviceHeading.state.status !== 'active') {
      headingSamplesRef.current = []
      setCompassJitterDeg(null)
      return
    }

    const now = Date.now()
    const h = deviceHeading.state.headingDeg
    const arr = headingSamplesRef.current
    arr.push({ h, t: now })
    // keep last ~3 seconds / up to 14 samples
    while (arr.length > 14) arr.shift()
    while (arr.length > 2 && now - arr[0]!.t > 3000) arr.shift()

    if (arr.length < 3) {
      setCompassJitterDeg(null)
      return
    }

    let sum = 0
    let cnt = 0
    for (let i = 1; i < arr.length; i++) {
      sum += Math.abs(shortestDeltaDeg(arr[i - 1]!.h, arr[i]!.h))
      cnt++
    }
    setCompassJitterDeg(cnt ? sum / cnt : null)
  }, [deviceHeading.state.status, deviceHeading.state.status === 'active' ? deviceHeading.state.updatedAt : 0])

  const accuracyBoostM = useMemo(() => {
    // GPS иногда “прыгает”. Чуть смягчаем порог открытия, но ограничиваем.
    const acc = user?.accuracyM
    if (!acc || !Number.isFinite(acc)) return 0
    return Math.min(Math.max(acc, 0), 80)
  }, [user?.accuracyM])

  const canDiscoverActiveTarget =
    !!activeTarget && !!user && activeTargetDistM <= activeTarget.radiusM + accuracyBoostM

  const headingMode = useMemo<'compass' | 'gps' | 'none'>(() => {
    if (deviceHeading.state.status === 'active') return 'compass'
    if (user?.heading != null && Number.isFinite(user.heading) && (user.speed ?? 0) > 0.6) return 'gps'
    if (typeof trackCourseDeg === 'number' && Number.isFinite(trackCourseDeg)) return 'gps'
    return 'none'
  }, [user?.heading, user?.speed, deviceHeading.state.status, trackCourseDeg])

  const calibrationIssue = useMemo(() => {
    if (!activeTarget || !user) return null
    if (deviceHeading.state.status === 'needs_permission') {
      return null
    }
    if (deviceHeading.state.status === 'denied') {
      return null
    }
    if (headingMode === 'none') {
      return null
    }
    if (headingMode !== 'compass') return null
    const acc = deviceHeading.state.status === 'active' ? deviceHeading.state.accuracyDeg : undefined
    if (typeof acc === 'number' && Number.isFinite(acc) && acc > 25) {
      return {
        message: `Компас неточный (~${Math.round(acc)}°). Покрути телефон “восьмёркой” 5–10 секунд и убери магнитный чехол/держатель.`,
      }
    }
    if (headingMode === 'compass' && typeof compassJitterDeg === 'number' && compassJitterDeg > 22) {
      return {
        message:
          'Компас “шумит”. Для калибровки покрути телефон “восьмёркой” и отойди от металла/магнитов.',
      }
    }
    return null
  }, [activeTarget?.id, user?.lat, user?.lon, deviceHeading.state, headingMode, compassJitterDeg])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  function discover(lm: Landmark) {
    if (discoveredIds.has(lm.id)) {
      showToast(`Уже открыто: ${lm.name}`)
      return
    }
    setProgress((p) => ({
      discovered: { ...p.discovered, [lm.id]: { discoveredAt: Date.now() } },
      xp: p.xp + lm.xp,
    }))
    showToast(`Открыто: ${lm.name} (+${lm.xp} XP)`)
  }

  function scanNearby() {
    if (!user) {
      showToast('Нужно включить геолокацию')
      return
    }
    const near = landmarksWithDistance
      .filter(
        ({ lm, distM }) =>
          distM <= lm.radiusM + accuracyBoostM && !discoveredIds.has(lm.id),
      )
      .map(({ lm }) => lm)

    if (near.length === 0) {
      showToast('Рядом ничего нового')
      return
    }
    near.forEach(discover)
  }

  function onReset() {
    resetProgress()
    setProgress(loadProgress())
    showToast('Прогресс сброшен')
  }

  const { level, nextAt, prevAt, progress: lvlProgress } = levelFromXp(progress.xp)

  const discoveredCount = discoveredIds.size
  const totalCount = LANDMARKS.length

  const geoStatusText =
    geo.status === 'unsupported'
      ? 'Геолокация не поддерживается в этом браузере'
      : geo.status === 'error'
        ? `Геолокация: ${geo.message}`
        : geo.status === 'idle'
          ? 'Геолокация выключена'
          : user?.accuracyM
            ? `Точность ~${Math.round(user.accuracyM)} м`
            : 'Геолокация активна'

  return (
    <div className="app">
      {arMode ? (
        <ARCameraView
          landmark={arMode.landmark}
          user={user}
          headingDeg={headingDeg}
          accuracyBoostM={accuracyBoostM}
          onCapture={(lm) => {
            discover(lm)
            showToast(`Нарзанник пойман! Открыто: ${lm.name} (+${lm.xp} XP)`)
            setArMode(null)
          }}
          onClose={() => setArMode(null)}
          showToast={showToast}
        />
      ) : null}

      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="brandTitle">Pyatigorsk GO</div>
            <div className="brandSub">
              {discoveredCount}/{totalCount} открыто • Уровень {level} • {geoStatusText}
            </div>
          </div>
          <div className="stats">
            <span className="pill">
              XP <strong>{progress.xp}</strong>
            </span>
            <span className="pill" title={`До следующего уровня: ${nextAt - progress.xp} XP`}>
              LVL <strong>{level}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="mapWrap">
          <MapView
            user={user}
            follow={followMe}
            landmarks={LANDMARKS}
            discoveredIds={discoveredIds}
            selectedId={selectedId}
            target={activeTarget ? { lat: activeTarget.lat, lon: activeTarget.lon } : undefined}
            mapProvider={mapProvider}
            navArrowDeg={
              navTargetId != null && typeof activeTargetBearing === 'number'
                ? activeTargetBearing
                : undefined
            }
            invalidateTick={mapInvalidateTick}
            onSelect={(id) => {
              setSelectedId(id)
              setNavTargetId((cur) => (cur ? id : cur))
              setTab('map')
              expandSheet()
            }}
          />
        </div>

        <CalibrationPrompt
          visible={navTargetId != null && !!calibrationIssue}
          message={calibrationIssue?.message ?? ''}
        />

        {toast ? (
          <div className="snackbar" aria-live="polite">
            <span className="pill">
              <strong>{toast}</strong>
            </span>
          </div>
        ) : null}

        {/* Показываем "цель/маршрут" поверх карты, когда панель свернута */}
        <NavigationHUD
          variant="floating"
          visible={sheetCollapsed && !!user && !!activeTarget && Number.isFinite(activeTargetDistM)}
          active={navTargetId != null}
          targetName={activeTarget?.name ?? 'Цель'}
          distanceM={activeTargetDistM}
          relativeDeg={relativeDeg}
          headingMode={headingMode}
          calibrationHint={null}
          onStart={async () => {
            if (!selected) {
              showToast('Сначала выбери точку')
              return
            }
            if (deviceHeading.state.status === 'needs_permission') {
              const ok = await deviceHeading.requestPermission()
              if (!ok) showToast('Компас: доступ запрещён')
            }
            setNavTargetId(selected.id)
            setTab('map')
            collapseSheet()
            showToast(`Маршрут: ${selected.name}`)
          }}
          onStop={() => {
            setNavTargetId(null)
            showToast('Маршрут остановлен')
          }}
        />

        <div
          ref={sheetRef}
          className={`sheet ${sheetCollapsed ? 'sheetCollapsed' : ''} ${sheetDragging ? 'sheetDragging' : ''}`}
          role="region"
          aria-label="Панель игры"
          style={{ transform: `translateY(${sheetTranslate}px)` }}
        >
          <div
            className="sheetHeader"
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return
              e.preventDefault()
              e.stopPropagation()
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              dragRef.current = {
                startY: e.clientY,
                startTranslate: sheetTranslate,
                startAt: performance.now(),
                pointerId: e.pointerId,
              }
              setSheetDragging(true)
            }}
            onPointerMove={(e) => {
              if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
              e.preventDefault()
              e.stopPropagation()
              const dy = e.clientY - dragRef.current.startY
              const next = clamp(dragRef.current.startTranslate + dy, sheetExpandedTranslate, sheetMaxTranslate)
              setSheetTranslate(next)
            }}
            onPointerUp={(e) => {
              if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
              e.preventDefault()
              e.stopPropagation()
              const dy = e.clientY - dragRef.current.startY
              const dt = Math.max(1, performance.now() - dragRef.current.startAt)
              const v = dy / dt // px/ms
              const isTap = Math.abs(dy) < 8 && dt < 250

              if (isTap) {
                setSheetMode((m) => (m === 'collapsed' ? 'expanded' : 'collapsed'))
              } else if (v < -0.55) {
                // quick swipe up => expand
                setSheetMode('expanded')
              } else if (v > 0.55) {
                // quick swipe down => collapse
                setSheetMode('collapsed')
              } else {
                // settle by position
                const mid = (sheetExpandedTranslate + sheetMaxTranslate) / 2
                setSheetMode(sheetTranslate > mid ? 'collapsed' : 'expanded')
              }
              setSheetDragging(false)
              dragRef.current = null
            }}
            onPointerCancel={(e) => {
              if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
              e.preventDefault()
              e.stopPropagation()
              const mid = (sheetExpandedTranslate + sheetMaxTranslate) / 2
              setSheetMode(sheetTranslate > mid ? 'collapsed' : 'expanded')
              setSheetDragging(false)
              dragRef.current = null
            }}
            aria-label="Свайп вниз/вверх"
          >
            <div className="sheetHandleBtn" aria-hidden>
              <span className="sheetHandle" />
            </div>

            <div className="sheetHeaderRow">
              <div className="sheetHeaderTitle">
                Панель • {discoveredCount}/{totalCount} • XP {progress.xp}
              </div>
            </div>
          </div>

          <NavigationHUD
            variant="sheet"
            visible={!sheetCollapsed && !!user && !!activeTarget && Number.isFinite(activeTargetDistM)}
            active={navTargetId != null}
            targetName={activeTarget?.name ?? 'Цель'}
            distanceM={activeTargetDistM}
            relativeDeg={relativeDeg}
            headingMode={headingMode}
            calibrationHint={null}
            onStart={async () => {
              if (!selected) {
                showToast('Сначала выбери точку')
                return
              }
              if (deviceHeading.state.status === 'needs_permission') {
                const ok = await deviceHeading.requestPermission()
                if (!ok) showToast('Компас: доступ запрещён')
              }
              setNavTargetId(selected.id)
              setTab('map')
              collapseSheet()
              showToast(`Маршрут: ${selected.name}`)
            }}
            onStop={() => {
              setNavTargetId(null)
              showToast('Маршрут остановлен')
            }}
          />

          <div className="sheetBody" aria-hidden={sheetCollapsed}>
            <div className="sheetRow">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={`btn ${tab === 'map' ? 'btnPrimary' : ''}`}
                  onClick={() => {
                    setTab('map')
                    expandSheet()
                  }}
                >
                  Карта
                </button>
                <button
                  className={`btn ${tab === 'collection' ? 'btnPrimary' : ''}`}
                  onClick={() => {
                    setTab('collection')
                    expandSheet()
                  }}
                >
                  Коллекция
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {installEvent ? (
                  <button
                    className="btn"
                    onClick={async () => {
                      try {
                        await installEvent.prompt()
                        await installEvent.userChoice
                        setInstallEvent(null)
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Установить
                  </button>
                ) : null}
                <button className="btn" onClick={scanNearby}>
                  Сканировать рядом
                </button>
              </div>
            </div>

          {tab === 'map' ? (
            <>
              <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div className="pill" style={{ width: 'fit-content' }}>
                  Уровень <strong>{level}</strong> • {Math.round(lvlProgress * 100)}% до следующего •{' '}
                  <strong>{nextAt - prevAt}</strong> XP/ур.
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(148,163,184,0.20)',
                    overflow: 'hidden',
                    border: '1px solid rgba(148,163,184,0.18)',
                  }}
                  aria-label="Прогресс уровня"
                >
                  <div
                    style={{
                      width: `${Math.round(lvlProgress * 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, rgba(34,197,94,0.95), rgba(59,130,246,0.95))',
                    }}
                  />
                </div>
              </div>

              <div className="list" aria-label="Список точек">
                {landmarksWithDistance.slice(0, 50).map(({ lm, distM }) => {
                  const discovered = discoveredIds.has(lm.id)
                  const inRange = user ? distM <= lm.radiusM + accuracyBoostM : false
                  return (
                    <div
                      key={lm.id}
                      className="card"
                      onClick={() => {
                        setSelectedId(lm.id)
                        expandSheet()
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div>
                        <div className="cardTitle">
                          {discovered ? '✓ ' : ''}{lm.name}
                        </div>
                        <div className="cardMeta">
                          {user ? (
                            <>
                              Расстояние: <strong>{formatDistance(distM)}</strong> • Радиус: {lm.radiusM} м •{' '}
                              {user.accuracyM ? (
                                <>
                                  Точность: ~{Math.round(user.accuracyM)} м
                                  {accuracyBoostM > 0 ? ` (учтено +${accuracyBoostM} м)` : ''}
                                  {' • '}
                                </>
                              ) : null}
                              {discovered ? `+${lm.xp} XP (уже)` : `+${lm.xp} XP`}
                            </>
                          ) : (
                            <>Включи GPS, чтобы увидеть расстояние и открыть точку</>
                          )}
                          {lm.source ? (
                            <>
                              {' '}
                              •{' '}
                              <a href={lm.source} target="_blank" rel="noreferrer">
                                источник
                              </a>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {!discovered ? (
                          <>
                            {inRange ? (
                              <button
                                className="btn btnPrimary"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (deviceHeading.state.status === 'needs_permission') {
                                    const ok = await deviceHeading.requestPermission()
                                    if (!ok) {
                                      showToast('Для AR нужен компас — разреши доступ к датчикам')
                                      return
                                    }
                                  }
                                  setArMode({ landmark: lm })
                                }}
                              >
                                Найти Нарзанника
                              </button>
                            ) : null}
                            <button
                              className={`btn ${inRange ? '' : 'btnPrimary'}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!inRange) {
                                  const need = lm.radiusM + accuracyBoostM
                                  showToast(`Подойди ближе: нужно ≤ ${need} м`)
                                  return
                                }
                                discover(lm)
                              }}
                            >
                              {inRange ? 'Открыть' : user ? `~${formatDistance(distM)}` : 'Далеко'}
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(lm.id)
                              // follow mode is derived from route state; no toggle here
                            }}
                          >
                            Показать
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {activeTarget ? (
                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="pill">
                    Цель: <strong>{activeTarget.name}</strong> • {user ? formatDistance(activeTargetDistM) : '—'}
                  </span>
                  {!discoveredIds.has(activeTarget.id) ? (
                    <>
                      {canDiscoverActiveTarget ? (
                        <button
                          className="btn btnPrimary"
                          onClick={async () => {
                            if (deviceHeading.state.status === 'needs_permission') {
                              const ok = await deviceHeading.requestPermission()
                              if (!ok) {
                                showToast('Для AR нужен компас — разреши доступ к датчикам')
                                return
                              }
                            }
                            setArMode({ landmark: activeTarget })
                          }}
                        >
                          Найти Нарзанника
                        </button>
                      ) : null}
                      <button
                        className={`btn ${canDiscoverActiveTarget ? '' : 'btnPrimary'}`}
                        onClick={() => {
                          if (!canDiscoverActiveTarget) {
                            const need = activeTarget.radiusM + accuracyBoostM
                            showToast(`Нужно подойти ближе: ≤ ${need} м`)
                            return
                          }
                          discover(activeTarget)
                        }}
                      >
                        Открыть цель
                      </button>
                    </>
                  ) : (
                    <span className="pill">
                      Статус: <strong>открыто</strong>
                    </span>
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {tab === 'collection' ? (
            <div className="list" aria-label="Коллекция">
              {LANDMARKS.map((lm) => {
                const discovered = discoveredIds.has(lm.id)
                const when = progress.discovered[lm.id]?.discoveredAt
                return (
                  <div key={lm.id} className="card">
                    <div>
                      <div className="cardTitle">{discovered ? `✓ ${lm.name}` : `🔒 ${lm.name}`}</div>
                      <div className="cardMeta">
                        {discovered && when ? `Открыто: ${new Date(when).toLocaleString()}` : 'Ещё не открыто'}
                        {' • '}Награда: {lm.xp} XP
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => setSelectedId(lm.id)}>
                        На карте
                      </button>
                    </div>
                  </div>
                )
              })}

              <div className="card" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
                <div>
                  <div className="cardTitle">Сбросить прогресс</div>
                  <div className="cardMeta">Удалит XP и все открытые точки на этом устройстве.</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                  <button className="btn btnDanger" onClick={onReset}>
                    Сбросить
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          </div>
        </div>
      </div>
    </div>
  )
}
