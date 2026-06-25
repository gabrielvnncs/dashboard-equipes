'use client'

import { useEffect, useState } from 'react'

interface ToastItem {
  id: number
  msg: string
  type: 'ok' | 'err'
}

let toastListeners: Array<(msg: string, type?: 'ok'|'err') => void> = []

export function toast(msg: string, type: 'ok'|'err' = 'ok') {
  toastListeners.forEach(fn => fn(msg, type))
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  let counter = 0

  useEffect(() => {
    const handler = (msg: string, type: 'ok'|'err' = 'ok') => {
      const id = ++counter
      setToasts(prev => [...prev, { id, msg, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
    }
    toastListeners.push(handler)
    return () => { toastListeners = toastListeners.filter(f => f !== handler) }
  }, [])

  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}
