const CAPTURE_TIMEOUT_MS = 15_000
const FRAME_WIDTH = 640

function once(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    video.addEventListener(event, () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error('Unreadable video')), { once: true })
  })
}

async function grab(video: HTMLVideoElement) {
  await once(video, 'loadeddata')
  const target = Math.min(1, video.duration / 10 || 0)
  if (target > 0) {
    video.currentTime = target
    await once(video, 'seeked')
  }
  if (!video.videoWidth) return null
  const scale = Math.min(1, FRAME_WIDTH / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

/** A frame one second in (a tenth of the way for short clips): the first frame is often black. */
export async function captureVideoFrame(src: string) {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = src
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS))
  try {
    return await Promise.race([grab(video), timeout])
  }
  catch {
    return null
  }
  finally {
    video.removeAttribute('src')
    video.load()
  }
}

export async function uploadVideoThumbnail(resourceId: string, src: string) {
  const frame = await captureVideoFrame(src)
  if (!frame) return false
  await api(`/api/resources/${resourceId}/thumbnail`, { method: 'PUT', body: frame })
  return true
}
