'use client'

import AppLayout from '@/components/layout/AppLayout'
import { Toast, toast } from '@/components/ui/Toast'
import { useDashboard } from '@/hooks/useDashboard'
import { ptn, ptnd } from '@/lib/utils'
import { CHART_COLORS } from '@/types'
import { useState } from 'react'

export default function EquipesPage() {
  const db = useDashboard()
  const [showModal, setShowModal] = useState(false)
  const [mName,  setMName]  = useState('')
  const [mAlias, setMAlias] = useState('')

  const teams = Object.keys(db.teamStats)
    .filter(t => db.teamStats[t].os_count > 0)
    .sort((a, b) => db.teamStats[b].total - db.teamStats[a].total)

  async function handleAddTeam() {
    if (!mName.trim()) { toast('Informe o nome da equipe.', 'err'); return }
    await db.addCustomTeam(mName.trim(), mAlias.trim() || undefined)
    setShowModal(false)
    setMName(''); setMAlias('')
    toast(`Equipe adicionada: ${mAlias.trim() || mName.trim()}`)
  }

  async function handleHide(team: string) {
    await db.setTeamHidden(team, true)
    toast(`"${db.getAlias(team)}" ocultada. Reative em Configurações.`)
  }

  if (db.loading) return <AppLayout><div style={{ padding:40, color:'var(--text2)' }}>Carregando…</div></AppLayout>

  return (
    <AppLayout>
      <Toast />

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h2 style={{ fontSize:'1.05rem', fontWeight:800 }}>Detalhamento por Equipe</h2>
        <div style={{ display:'flex', gap:8 }}>
          {db.userRole === 'admin' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Adicionar Equipe</button>
          )}
        </div>
      </div>

      {/* Team Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16, marginBottom:20 }}>
        {teams.map((t, i) => {
          const st = db.teamStats[t]
          const allSvcs = Object.entries(st.services).sort((a,b) => b[1]-a[1])
          const color = CHART_COLORS[i % CHART_COLORS.length]

          return (
            <div key={t} className="card" style={{ position:'relative', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                <div>
                  <div style={{ fontSize:'2.2rem', fontWeight:800, fontFamily:'var(--mono)', opacity:.18, lineHeight:1, marginBottom:6 }}>#{i+1}</div>
                  <div style={{ fontSize:'0.92rem', fontWeight:700, marginBottom:12, lineHeight:1.3 }}>{db.getAlias(t)}</div>
                </div>
                {db.userRole === 'admin' && (
                  <button
                    className="btn btn-danger btn-xs"
                    style={{ marginTop:4, flexShrink:0 }}
                    onClick={() => handleHide(t)}
                  >✕ Ocultar</button>
                )}
              </div>

              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:14 }}>
                <div style={{ fontSize:'1.7rem', fontWeight:800, fontFamily:'var(--mono)', color }}>{ptn(st.total)}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text2)', fontWeight:600 }}>pontos</div>
                <span className="chip chip-blue" style={{ marginLeft:'auto' }}>{ptn(st.os_count)} OS</span>
              </div>

              <div style={{ maxHeight:200, overflowY:'auto', paddingRight:4 }}>
                {allSvcs.map(([s, c]) => (
                  <div key={s} style={{ padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ fontSize:'.78rem', color:'var(--text)', lineHeight:1.4, marginBottom:3 }}>{s}</div>
                    <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                      <span style={{ fontFamily:'var(--mono)', fontSize:'.75rem', color:'var(--text2)' }}>{c}×</span>
                      <span style={{ fontFamily:'var(--mono)', fontSize:'.75rem', color:'var(--accent3)' }}>{ptnd(c * (db.scores[s] ?? 1))} pts</span>
                    </div>
                  </div>
                ))}
                {allSvcs.length === 0 && <p style={{ fontSize:'.78rem', color:'var(--text3)' }}>Nenhum serviço registrado.</p>}
              </div>
            </div>
          )
        })}

        {teams.length === 0 && (
          <div className="empty-state" style={{ gridColumn:'1/-1' }}>
            <p>Nenhuma equipe com OS no período filtrado.</p>
          </div>
        )}
      </div>

      {/* Modal Add Team */}
      {showModal && (
        <div className="overlay open" onClick={e => { if(e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <h3 style={{ fontSize:'1.05rem', fontWeight:800, marginBottom:18 }}>Adicionar Equipe</h3>
            <div style={{ marginBottom:13 }}>
              <label style={{ display:'block', fontSize:'.7rem', fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>
                Nome (exato, como no CSV)
              </label>
              <input className="input" value={mName} onChange={e => setMName(e.target.value)} placeholder="Ex: 01- LIN - INSTALACAO - F 01" />
            </div>
            <div style={{ marginBottom:13 }}>
              <label style={{ display:'block', fontSize:'.7rem', fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>
                Apelido (exibição)
              </label>
              <input className="input" value={mAlias} onChange={e => setMAlias(e.target.value)} placeholder="Ex: Instalação Lins 01" />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddTeam}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
