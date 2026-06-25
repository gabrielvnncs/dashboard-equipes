'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface UserInfo {
  id: string
  email: string
  role: 'admin' | 'viewer'
}

export function useUser() {
  const supabase = createClient()
  const [user, setUser]     = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setUser(null); setLoading(false); return }

        // Tenta buscar o perfil até 3 vezes (às vezes o trigger de criação demora)
        let profile = null
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .single()

          if (data && !error) { profile = data; break }
          // Aguarda 500ms antes de tentar novamente
          if (attempt < 2) await new Promise(r => setTimeout(r, 500))
        }

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: (profile?.role as 'admin' | 'viewer') || 'viewer',
        })
      } catch (err) {
        console.error('useUser error:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    load()

    // Recarrega quando sessão muda (ex: login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}