/**
 * Profile photo storage — client-side only, deliberately.
 *
 * There is no `avatar_url` column anywhere in `schema.sql` for any phase, and
 * adding one means a migration plus real file storage (S3 or equivalent),
 * which is a backend decision this UI task didn't ask for. Storing the image
 * as a data URL in localStorage, keyed by user id, gives the upload control a
 * real place to put the photo and makes it survive a reload on this device,
 * without inventing server infrastructure. It will not follow the user to
 * another browser or device — the honest limitation of doing this client-only.
 */

const STORAGE_PREFIX = 'pgms.avatar.'
const AVATAR_EVENT = 'pgms:avatar-changed'

// Large enough for a genuine photo, small enough that localStorage (5-10MB
// per origin in most browsers) does not fill up after a couple of changes.
const MAX_BYTES = 1_500_000

export function getAvatar(userId: string | undefined): string | null {
  if (!userId) return null
  try {
    return localStorage.getItem(STORAGE_PREFIX + userId)
  } catch {
    return null
  }
}

export function setAvatar(userId: string, dataUrl: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, dataUrl)
  } catch {
    // Storage full or unavailable (private browsing) — the upload simply
    // will not persist; nothing here is worth surfacing as a hard error.
  }
  // localStorage's own "storage" event only fires in *other* tabs, so the
  // header avatar in this tab needs its own signal to pick up the change.
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId } }))
}

export function clearAvatar(userId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + userId)
  } catch {
    /* see setAvatar */
  }
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId } }))
}

export function onAvatarChanged(handler: () => void): () => void {
  window.addEventListener(AVATAR_EVENT, handler)
  return () => window.removeEventListener(AVATAR_EVENT, handler)
}

export async function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file (PNG, JPG, etc.).')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Choose an image under 1.5 MB.')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}
