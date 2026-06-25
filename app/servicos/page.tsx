'use client'

import AppLayout from '@/components/layout/AppLayout'
import { Toast, toast } from '@/components/ui/Toast'
import { useDashboard } from '@/hooks/useDashboard'
import { ptn, ptnd } from '@/lib/utils'
import { DEFAULT_SCORES } from '@/types'
import { useState } from 'react'

export default function ServicosPage() {
  const db = useDashboard()
  const [search, setSearch]       = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [mName,  setMName]  = useState('')
  const [mTipo,  setMTipo]  = useState('MANUTENCAO')
  const [mScore, setMScore] = useState('5')

  // Build service map from filtered orders
  const svcMap: Record<string, { tipo: string; count: number }> = {}
  db.filteredOrders.forEach(r => {
    if (!r.service) return
    if (!svcMap[r.service]) svcMap[r.service] = { tipo: r.service_type || '—', count: 0 }
    svcMap[r.service].count++
  })

  let svcs = Object.entries(svcMap)
    .filter(([n]) => !db.removedServices.has(n))
    .sort((a, b) => b[1].count - a[1].count)

  if (search) svcs = svcs.filter(([n]) => n.toLowerCase().includes(search.toLowerCase()))
  if (tipoFilter) svcs = svcs.filter(([, d]) => d.tipo === tipoFilter)

  const tipos = Array.from(new Set(Object.values(svcMap).map(d => d.tipo).filter(t => t && t !== '—'))).sort()

  async function handleScoreChange(service: string, val: string) {
    const pts = parseFloat(val) || 0
    await db.updateScore(service, pts)
  }

  async function handleRemove(service: string) {
    if (!confirm(`Remover serviço "${service}" da dashboard?\n\nEle não aparecerá mais mesmo que esteja no CSV.`)) return
    await db.removeService(service)
    toast('Serviço removido.')
  }

  async function handleResetScores() {
    if (!confirm('Restaurar todas as pontuações ao padrão?')) return
    for (const [svc, pts] of Object.entries(DEFAULT_SCORES)) {
      await db.updateScore(svc, pts)
    }
    toast('Pontuações restauradas.')
  }

  async function handleAddService() {
    const name = mName.trim().toUpperCase()
    if (!name) { toast('Informe o nome do serviço.', 'err'); return }
    await db.updateScore(name, parseFloat(mScore) || 1)
    setShowModal(false)
    setMName(''); setMScore('5')
    toast(`Serviço adicionado: ${name}`)
  }

  if (db.loading) return <AppLayout><div style={{ padding:40, color:'var(--text2)' }}>Carregando…</div></AppLayout>

  return (
    <AppLayout>
      <Toast />

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h2 style={{ fontSize:'1.05rem', fontWeight:800 }}>Serviços Registrados</h2>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <select className="input input-sm" style={{ width:'auto' }} value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
            <option value="">Todos os tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className="input input-sm"
            style={{ width:200 }}
            placeholder="Buscar serviço…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {db.userRole === 'admin' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleResetScores}>↺ Restaurar pontos</button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Novo Serviço</button>
            </>
          )}
        </div>
      </div>

      <p style={{ fontSize:'.78rem', color:'var(--text2)', marginBottom:14 }}>
        {db.userRole === 'admin'
          ? 'Edite a pontuação diretamente na tabela. Aceita decimais (ex: 1.5). Alterações salvas automaticamente.'
          : 'Visualizando serviços e pontuações. Apenas administradores podem editar.'}
      </p>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Serviço</th>
            <th>Tipo</th>
            <th>Qtd. Execuções</th>
            <th>Pontos / OS</th>
            <th>Total Pontos</th>
            {db.userRole === 'admin' && <th>Ações</th>}
          </tr></thead>
          <tbody>
            {svcs.map(([name, d]) => {
              const pts = db.scores[name] ?? 1
              return (
                <tr key={name}>
                  <td>{name}</td>
                  <td><span className="chip chip-blue">{d.tipo}</span></td>
                  <td>{ptn(d.count)}</td>
                  <td>
                    {db.userRole === 'admin' ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <input
                          type="number" min="0" step="any"
                          defaultValue={pts}
                          onBlur={e => handleScoreChange(name, e.target.value)}
                          style={{
                            width:68, background:'var(--surface2)', border:'1px solid var(--border)',
                            color:'var(--accent)', padding:'4px 7px', borderRadius:6,
                            fontFamily:'var(--mono)', fontSize:'0.85rem', fontWeight:700,
                            outline:'none', textAlign:'center',
                          }}
                        />
                        <span style={{ fontSize:'.7rem', color:'var(--text3)' }}>pts</span>
                      </div>
                    ) : (
                      <span className="score-inline">{ptnd(pts)}</span>
                    )}
                  </td>
                  <td><span className="total-inline">{ptnd(pts * d.count)}</span></td>
                  {db.userRole === 'admin' && (
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => handleRemove(name)}>Remover</button>
                    </td>
                  )}
                </tr>
              )
            })}
            {svcs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'var(--text2)' }}>Nenhum serviço encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal new service */}
      {showModal && (
        <div className="overlay open" onClick={e => { if(e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <h3 style={{ fontSize:'1.05rem', fontWeight:800, marginBottom:18 }}>Novo Serviço</h3>
            <div style={{ marginBottom:13 }}>
              <label style={{ display:'block', fontSize:'.7rem', fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>Nome do Serviço</label>
              <input className="input" value={mName} onChange={e => setMName(e.target.value)} placeholder="Ex: CONFIGURAÇÃO DE ROTEADOR" />
            </div>
            <div style={{ marginBottom:13 }}>
              <label style={{ display:'block', fontSize:'.7rem', fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>Tipo</label>
              <select className="input" value={mTipo} onChange={e => setMTipo(e.target.value)}>
                {['MANUTENCAO','INSTALACAO PRINCIPAL','SERVICOS','INTERNO','RETIRADA','REDE - NOC','OUTRO'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:13 }}>
              <label style={{ display:'block', fontSize:'.7rem', fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>Pontos por execução</label>
              <input type="number" min="0" step="any" className="input" value={mScore} onChange={e => setMScore(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:18 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddService}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
