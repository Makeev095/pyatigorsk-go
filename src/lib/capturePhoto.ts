/**
 * Захвает композитный кадр: видео с камеры + overlay (Нарзанник).
 * Возвращает Blob с изображением в формате JPEG.
 */
export async function capturePhoto(
  video: HTMLVideoElement,
  drawOverlay: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): Promise<Blob> {
  const width = video.videoWidth
  const height = video.videoHeight

  if (!width || !height) {
    throw new Error('Не удалось получить размер видео')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Не удалось создать контекст canvas')

  ctx.drawImage(video, 0, 0, width, height)
  drawOverlay(ctx, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Не удалось создать изображение'))
      },
      'image/jpeg',
      0.9,
    )
  })
}
