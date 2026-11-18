import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isNoMetricsError, WS_URL } from '../services/api'

const MAX_HISTORY = 500

export function useMetrics() {
  const [metrics, setMetrics] = useState([])
  const [system, setSystem] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState('connecting')
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const retryRef = useRef(null)
  const retryDelayRef = useRef(1000)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      api.history(MAX_HISTORY),
      api.system(),
      api.alerts(),
      api.settings(),
    ])
    if (!mountedRef.current) return

    const [historyResult, systemResult, alertResult, settingsResult] = results
    if (historyResult.status === 'fulfilled') {
      setMetrics(historyResult.value.slice().reverse())
    } else if (isNoMetricsError(historyResult.reason)) {
      setMetrics([])
    } else {
      setError(historyResult.reason?.message || 'Unable to load metrics')
    }
    if (systemResult.status === 'fulfilled') setSystem(systemResult.value)
    if (alertResult.status === 'fulfilled') setAlerts(alertResult.value)
    if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value)
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => {
      mountedRef.current = false
      clearTimeout(retryRef.current)
      socketRef.current?.close()
    }
  }, [refresh])

  useEffect(() => {
    let disposed = false
    const connect = () => {
      if (disposed) return
      setConnection(socketRef.current ? 'reconnecting' : 'connecting')
      let socket
      try {
        socket = new WebSocket(WS_URL)
        socketRef.current = socket
      } catch {
        setConnection('offline')
        retryRef.current = setTimeout(connect, retryDelayRef.current)
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000)
        return
      }

      socket.onopen = () => {
        if (disposed) return socket.close()
        retryDelayRef.current = 1000
        setConnection('live')
        setError('')
        socket.send('subscribe')
      }
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type !== 'metrics' || !payload.data) return
          const metric = payload.data
          setMetrics((previous) => {
            if (previous.some((item) => item.id === metric.id)) return previous
            return [...previous, metric].slice(-MAX_HISTORY)
          })
          api.alerts().then((next) => {
            if (mountedRef.current) setAlerts(next)
          }).catch(() => {})
        } catch {
          setError('Received an unreadable update from the metrics service.')
        }
      }
      socket.onerror = () => setConnection('offline')
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null
        if (disposed) return
        setConnection('reconnecting')
        retryRef.current = setTimeout(connect, retryDelayRef.current)
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000)
      }
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(retryRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  const saveSettings = useCallback(async (nextSettings) => {
    const saved = await api.updateSettings(nextSettings)
    setSettings(saved)
    return saved
  }, [])

  return { metrics, system, alerts, settings, loading, connection, error, refresh, saveSettings }
}
