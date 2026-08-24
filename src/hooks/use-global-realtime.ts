'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const WATCHED_TABLES = [
  'contracts', 'activities', 'leads', 'pipeline_runs',
  'implementation_schedules', 'implementation_tasks', 'task_comments',
]

export function useGlobalRealtime() {
  const router = useRouter()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const supabase = createClient()

    function scheduleRefresh(table: string) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        console.log('[realtime] refresh por:', table)
        router.refresh()
      }, 600)
    }

    const channel = supabase
      .channel('crm-global')
      .on('postgres_changes', { event: '*', schema: 'contract_crm' }, (payload) => {
        const table = (payload as any).table ?? ''
        if (WATCHED_TABLES.includes(table)) scheduleRefresh(table)
      })
      .subscribe(status => console.log('[realtime]', status))

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [router])
}
