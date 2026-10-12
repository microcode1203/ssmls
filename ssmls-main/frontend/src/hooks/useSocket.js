// useSocket.js — Real-time Socket.io hook
// Place in: frontend/src/hooks/useSocket.js

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

export function useSocket() {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [latestNotif, setLatestNotif] = useState(null)

  useEffect(() => {
    if (!user?.id) return

    // Connect
    const socket = io(SOCKET_URL, {
      auth: { userId: String(user.id) },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      console.log('🔌 Socket connected')
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    // Real-time notification received
    socket.on('notification', (notif) => {
      setLatestNotif(notif)
      setUnreadCount(c => c + 1)
    })

    // Unread count from server
    socket.on('unread_count', (count) => {
      setUnreadCount(count)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id])

  const markRead = (notifId = 'all') => {
    socketRef.current?.emit('mark_read', notifId)
    if (notifId === 'all') setUnreadCount(0)
    else setUnreadCount(c => Math.max(0, c - 1))
  }

  return { connected, unreadCount, latestNotif, markRead, socket: socketRef.current }
}
