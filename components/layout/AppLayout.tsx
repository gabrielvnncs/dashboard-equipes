'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'

const TABS = [
  { href: '/dashboard',      label: '📊 Dashboard' },
  { href: '/equipes',        label: '👥 Equipes' },
  { href: '/servicos',       label: '🔧 Serviços' },
  { href: '/configuracoes',  label: '⚙️ Configurações' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { user, loading } = useUser()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const role  = user?.role || 'viewer'
  const email = user?.email || ''

  return (
    <>
      {/* ── Header ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 200,
        gap: 16,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, fontSize:'1.05rem', letterSpacing:'-0.5px' }}>
          <div style={{
            width:28, height:28, background:'var(--accent)',
            borderRadius:7, display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:'0.9rem',
          }}>◈</div>
          Dashboard de Equipes
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {loading ? (
            <span style={{ fontSize:'0.78rem', color:'var(--text3)' }}>…</span>
          ) : (
            <>
              <span className={`chip ${role === 'admin' ? 'chip-blue' : 'chip-gray'}`}>
                {role === 'admin' ? '⚡ Admin' : '👁 Viewer'}
              </span>
              <span style={{ fontSize:'0.78rem', color:'var(--text3)' }}>{email}</span>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={{
        display:'flex', gap:2, padding:'0 28px',
        borderBottom:'1px solid var(--border)',
        background:'var(--surface)', overflowX:'auto',
      }}>
        {TABS.map(tab => {
          const active = pathname.startsWith(tab.href)
          return (
            <Link key={tab.href} href={tab.href} style={{
              padding:'12px 20px',
              borderBottom:`2px solid ${active ? 'var(--accent)' : 'transparent'}`,
              color: active ? 'var(--accent)' : 'var(--text2)',
              fontWeight:700, fontSize:'0.85rem', textDecoration:'none',
              whiteSpace:'nowrap', letterSpacing:'0.3px', transition:'color 0.2s',
            }}>
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* ── Content ── */}
      <main style={{ maxWidth:1440, margin:'0 auto', padding:'24px 28px' }}>
        {children}
      </main>
    </>
  )
}