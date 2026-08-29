import { useEffect, useState } from 'react'

import { getAvatar, onAvatarChanged } from '@/utils/avatar'

/** Re-renders wherever it's used when the current user's photo changes. */
export function useAvatar(userId: string | undefined): string | null {
  const [avatar, setAvatarState] = useState<string | null>(() => getAvatar(userId))

  useEffect(() => {
    setAvatarState(getAvatar(userId))
    return onAvatarChanged(() => setAvatarState(getAvatar(userId)))
  }, [userId])

  return avatar
}
