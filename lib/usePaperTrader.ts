"use client"
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AutoTraderState } from './useAutoTrader'

export function usePaperTrader(pollMs = 5000) {
  const [state, setState] = useState<AutoTraderState | null>(null); const [loading, setLoading] = useState(true); const [acting, setActing] = useState<string | null>(null); const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const refetch = useCallback(async () => { try { const res = await fetch('/api/paper-trader', { cache: 'no-store' }); setState(await res.json()) } finally { setLoading(false) } }, [])
  useEffect(() => { refetch(); ref.current = setInterval(refetch, pollMs); return () => { if (ref.current) clearInterval(ref.current) } }, [refetch, pollMs])
  const runAction = useCallback(async (action: 'start' | 'stop' | 'close-all' | 'reset' | 'brutal-on' | 'brutal-off') => { setActing(action); try { const res = await fetch(`/api/paper-trader?action=${action}`, { method: 'POST' }); setState(await res.json()) } finally { setActing(null) } }, [])
  return { state, loading, acting, refetch, runAction }
}
