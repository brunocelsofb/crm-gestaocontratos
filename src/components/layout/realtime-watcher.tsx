'use client'

import { useGlobalRealtime } from '@/hooks/use-global-realtime'

export function RealtimeWatcher() {
  useGlobalRealtime()
  return null
}
