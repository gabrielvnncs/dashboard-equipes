'use client'

import AppLayout from '@/components/layout/AppLayout'
import { Toast } from '@/components/ui/Toast'
import { useDashboard } from '@/hooks/useDashboard'
import { ptn, ptnd, trunc, exportRankingCSV } from '@/lib/utils'
import { CHART_COLORS, MONTH_NAMES, VALID_CITIES } from '@/types'
import { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)
ChartJS.defaults.color = '#8892aa'
ChartJS.defaults.font.family = 'Inter, sans-serif'
ChartJS.defaults.font.size = 11

const GRID_COLOR = '#242938'

export default function DashboardPage() {
  const db = useDashboard()
  const [rankMode, setRankMode]   = useState<'pts'|'os'>('pts')
  const [histMode, setHistMode]   = useState<'total'|'byteam'|'byservice'>('total')
  const [histSvc,  setHistSvc]    = useState('')
  const [sortField, setSortField] = useState<'pts'|'os'|'name'|'types'>('pts')
  const [sortDir,   setSortDir]   = useState(-1)

  // ── Computed ────────────────────────────────────────────────
  const teams = Object.keys(db.teamStats)
    .filter(t => db.teamStats[t].os_count > 0)
    .sort((a, b) => rankMode === 'pts'
      ? db.teamStats[b].total - db.teamStats[a].total
      : db.teamStats[b].os_count - db.teamStats[a].os_count)

  const sorted = [...teams].sort((a, b) => {
    const st = db.teamStats
    const val: Record<string, (t: string) => number|string> = {
      pts:   t => st[t].total,
      os:    t => st[t].os_count,
      name:  t => db.getAlias(t),
      types: t => Object.keys(st[t].services).length,
    }
    const va = val[sortField](a), vb = val[sortField](b)
    return typeof va === 'string' ? (va as string).localeCompare(vb as string) * sortDir : ((va as number) - (vb as number)) * sortDir
  })

  const totalOS  = db.filteredOrders.length
  const totalPts = teams.reduce((s, t) => s + db.teamStats[t].total, 0)
  const leader   = teams[0]

  // Months available
  const months = [...new Set(
    db.allOrders.map(o => (o.executed_at || '').slice(0, 7)).filter(Boolean)
  )].sort()

  // Month chips
  function selectMonth(month: string) {
    if (!month) {
      const dates = db.allOrders.map(o => o.executed_at).filter(Boolean).sort() as string[]
      db.setFilters(prev => ({ ...prev, dateStart: dates[0] || '', dateEnd: dates[dates.length-1] || '' }))
    } else {
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      db.setFilters(prev => ({
        ...prev,
        dateStart: `${month}-01`,
        dateEnd:   `${month}-${String(lastDay).padStart(2, '0')}`,
      }))
    }
  }

  // Chart data
  const top10   = teams.slice(0, 10)
  const svcCnt  = db.filteredOrders.reduce<Record<string,number>>((acc, r) => {
    if (r.service && !db.removedServices.has(r.service)) acc[r.service] = (acc[r.service]||0)+1
    return acc
  }, {})
  const topSvcs = Object.entries(svcCnt).sort((a,b) => b[1]-a[1]).slice(0,8)

  // Periods for history
  const periods = [...new Set(
    db.filteredOrders.map(o => (o.executed_at||'').slice(0,7)).filter(Boolean)
  )].sort()

  function buildHistDatasets() {
    if (histMode === 'total') {
      const byM = periods.reduce<Record<string,number>>((a,p) => { a[p]=0; return a }, {})
      db.filteredOrders.forEach(o => { const d=(o.executed_at||'').slice(0,7); if(d) byM[d]=(byM[d]||0)+1 })
      return [{
        label: 'OS', data: periods.map(p => byM[p]||0),
        borderColor: '#5b7fff', backgroundColor: 'rgba(91,127,255,.1)',
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#5b7fff',
      }]
    }
    if (histMode === 'byteam') {
      return teams.slice(0,5).map((t,i) => {
        const byM: Record<string,number> = {}
        db.filteredOrders.filter(o => o.team === t).forEach(o => {
          const d=(o.executed_at||'').slice(0,7); if(d) byM[d]=(byM[d]||0)+1
        })
        return {
          label: trunc(db.getAlias(t), 20),
          data: periods.map(p => byM[p]||0),
          borderColor: CHART_COLORS[i], backgroundColor: 'transparent',
          tension: 0.4, pointRadius: 3, pointBackgroundColor: CHART_COLORS[i],
        }
      })
    }
    // byservice
    const byM: Record<string,number> = {}
    db.filteredOrders
      .filter(o => o.service === histSvc && !db.removedServices.has(o.service||''))
      .forEach(o => { const d=(o.executed_at||'').slice(0,7); if(d) byM[d]=(byM[d]||0)+1 })
    return [{
      label: histSvc || '—',
      data: periods.map(p => byM[p]||0),
      borderColor: '#43e8b0', backgroundColor: 'rgba(67,232,176,.08)',
      fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#43e8b0',
    }]
  }

  const stackedTeams = teams.slice(0, 8)
  const allTipos = [...new Set(db.filteredOrders.map(o => o.service_type).filter(Boolean))] as string[]

  if (db.loading) return (
    <AppLayout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--text2)' }}>
        Carregando dados…
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <Toast />

      {/* ── Month chips ── */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:10 }}>
        <span style={{ fontSize:'.7rem', fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.8px' }}>Mês rápido:</span>
        {months.map(m => {
          const [y,mo] = m.split('-')
          return (
            <button key={m} className="month-chip" onClick={() => selectMonth(m)}>
              {MONTH_NAMES[parseInt(mo)-1]}/{y.slice(2)}
            </button>
          )
        })}
        <button className="month-chip month-chip-all" onClick={() => selectMonth('')}>Todos</button>
      </div>

      {/* ── Filters ── */}
      <div className="filter-bar">
        <div className="fg">
          <label>Situação</label>
          <select className="input input-sm" value={db.filters.situacao} onChange={e => db.setFilters(p => ({...p, situacao: e.target.value}))}>
            <option value="">Todas</option>
            <option value="Executada">Executada</option>
            <option value="Sem Execução">Sem Execução</option>
            <option value="Finalizada">Finalizada</option>
            <option value="Pendente">Pendente</option>
          </select>
        </div>
        <div className="fg">
          <label>Cidade</label>
          <select className="input input-sm" value={db.filters.cidade} onChange={e => db.setFilters(p => ({...p, cidade: e.target.value}))}>
            <option value="">Todas</option>
            {Object.entries(VALID_CITIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="fg">
          <label>Equipe</label>
          <select className="input input-sm" value={db.filters.equipe} onChange={e => db.setFilters(p => ({...p, equipe: e.target.value}))}>
            <option value="">Todas</option>
            {db.getTeams().map(t => <option key={t} value={t}>{db.getAlias(t)}</option>)}
          </select>
        </div>
        <div className="fg">
          <label>De</label>
          <input type="date" className="input input-sm" value={db.filters.dateStart} onChange={e => db.setFilters(p => ({...p, dateStart: e.target.value}))} />
        </div>
        <div className="fg">
          <label>Até</label>
          <input type="date" className="input input-sm" value={db.filters.dateEnd} onChange={e => db.setFilters(p => ({...p, dateEnd: e.target.value}))} />
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop:'auto' }}
          onClick={() => db.setFilters({ situacao:'Executada', cidade:'', equipe:'', dateStart:'', dateEnd:'', activeTipos: new Set() })}>
          ✕ Limpar
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="stats-grid">
        {[
          { label:'OS no Período',    val: ptn(totalOS),     sub:'registros filtrados',   hex:'var(--accent)',  },
          { label:'Pontos Totais',    val: ptn(totalPts),    sub:'soma das equipes',       hex:'var(--accent3)', },
          { label:'Equipes Ativas',   val: teams.length,     sub:'com OS no período',      hex:'var(--accent4)', },
          { label:'Tipos de Serviço', val: Object.keys(svcCnt).length, sub:'serviços distintos', hex:'var(--accent2)', },
          ...(leader ? [{ label:'Líder Atual', val: trunc(db.getAlias(leader), 16) || '—', sub: ptn(db.teamStats[leader]?.total||0)+' pts', hex:'var(--accent5)' }] : []),
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ '--c': s.hex } as React.CSSProperties}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Ranking — Top 10</span>
            <select className="input input-sm" style={{ width:'auto' }} value={rankMode} onChange={e => setRankMode(e.target.value as 'pts'|'os')}>
              <option value="pts">Por Pontos</option>
              <option value="os">Por Qtd. OS</option>
            </select>
          </div>
          <div style={{ height: 260 }}>
            <Bar
              data={{
                labels: top10.map(t => trunc(db.getAlias(t), 22)),
                datasets: [{
                  label: rankMode==='pts' ? 'Pontos' : 'OS',
                  data: top10.map(t => rankMode==='pts' ? db.teamStats[t].total : db.teamStats[t].os_count),
                  backgroundColor: CHART_COLORS,
                  borderRadius: 6,
                }],
              }}
              options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ color:GRID_COLOR }}, y:{ grid:{ color:GRID_COLOR }}}}}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Top 8 Serviços (Volume)</span></div>
          <div style={{ height: 260 }}>
            <Doughnut
              data={{
                labels: topSvcs.map(s => trunc(s[0], 34)),
                datasets: [{ data: topSvcs.map(s => s[1]), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#12161f' }],
              }}
              options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#8892aa', font:{ size:10 }, boxWidth:11, padding:8 }}}}}
            />
          </div>
        </div>
      </div>

      {/* ── History chart ── */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-header">
          <span className="card-title">Histórico de Execuções por Mês</span>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <select className="input input-sm" style={{ width:'auto' }} value={histMode} onChange={e => { setHistMode(e.target.value as typeof histMode); }}>
              <option value="total">Total</option>
              <option value="byteam">Por Equipe (Top 5)</option>
              <option value="byservice">Por Serviço</option>
            </select>
            {histMode === 'byservice' && (
              <select className="input input-sm" style={{ maxWidth:220 }} value={histSvc} onChange={e => setHistSvc(e.target.value)}>
                {[...new Set(db.filteredOrders.map(o => o.service).filter(s => s && !db.removedServices.has(s!)) as string[])].sort().map(s => (
                  <option key={s} value={s}>{trunc(s, 40)}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div style={{ height: 220 }}>
          <Line
            data={{ labels: periods, datasets: buildHistDatasets() }}
            options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }}, scales:{ x:{ grid:{ color:GRID_COLOR }}, y:{ grid:{ color:GRID_COLOR }}}}}
          />
        </div>
      </div>

      {/* ── Stacked chart ── */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-header"><span className="card-title">Distribuição de Tipos de Serviço por Equipe</span></div>
        <div style={{ height: 320 }}>
          <Bar
            data={{
              labels: stackedTeams.map(t => trunc(db.getAlias(t), 22)),
              datasets: allTipos.map((tp, i) => ({
                label: tp,
                data: stackedTeams.map(t => db.teamStats[t]?.tipos[tp]||0),
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              })),
            }}
            options={{
              responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ position:'top', labels:{ color:'#8892aa', font:{ size:10 }, boxWidth:11 }}},
              scales:{
                x:{ stacked:true, grid:{ color:GRID_COLOR }},
                y:{ stacked:true, grid:{ color:GRID_COLOR }},
              },
            }}
          />
        </div>
      </div>

      {/* ── Ranking table ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <h2 style={{ fontSize:'1.05rem', fontWeight:800 }}>Tabela Ranking de Equipes</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => exportRankingCSV(db.teamStats, Object.fromEntries(db.teamSettings.map(t=>[t.team, t.alias||t.team])))}>↓ Exportar</button>
      </div>
      <div className="table-wrap" style={{ marginBottom:24 }}>
        <table>
          <thead><tr>
            <th style={{ cursor:'default' }}>#</th>
            {([['name','Equipe'],['os','OS Exec.'],['types','Tipos Svc'],['pts','Pontuação']] as const).map(([f,label]) => (
              <th key={f} onClick={() => { if(sortField===f) setSortDir(d=>d*-1); else { setSortField(f); setSortDir(-1) } }}
                style={{ color: sortField===f ? 'var(--accent)' : undefined }}>
                {label} <span style={{ opacity: sortField===f ? 1 : 0.4 }}>↕</span>
              </th>
            ))}
            <th style={{ cursor:'default' }}>Progresso</th>
          </tr></thead>
          <tbody>
            {sorted.map((t, i) => {
              const st = db.teamStats[t]
              const max = db.teamStats[sorted[0]]?.total || 1
              const pct = Math.round((st.total / max) * 100)
              const rc  = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-o'
              return (
                <tr key={t}>
                  <td><span className={`rank-badge ${rc}`}>{i+1}</span></td>
                  <td><strong>{db.getAlias(t)}</strong></td>
                  <td><span className="chip chip-blue">{ptn(st.os_count)}</span></td>
                  <td>{Object.keys(st.services).length}</td>
                  <td><span className="score-inline">{ptn(st.total)}</span></td>
                  <td><div className="pbar"><div className="pbar-fill" style={{ width:`${pct}%`, background:CHART_COLORS[i%CHART_COLORS.length] }} /></div></td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:24, color:'var(--text2)' }}>Nenhum dado para os filtros selecionados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
