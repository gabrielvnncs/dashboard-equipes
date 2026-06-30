'use client'

export const dynamic = 'force-dynamic'

import AppLayout from '@/components/layout/AppLayout'
import { Toast, toast } from '@/components/ui/Toast'
import { useDashboard } from '@/hooks/useDashboard'
import { ptn } from '@/lib/utils'
import { ALLOWED_COLUMNS, MONTH_NAMES } from '@/types'
import { sanitizeCSVRow } from '@/lib/utils'
import { useRef, useState } from 'react'
import Papa from 'papaparse'

export default function ConfiguracoesPage() {
  const db = useDashboard()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [purgeMonth, setPurgeMonth] = useState('')
  const [aliasEdits, setAliasEdits] = useState<Record<string,string>>({})

  // ── CSV import ───────────────────────────────────────────────
  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: async (results) => {
        try {
          const rows = (results.data as Record<string, string>[]).map(sanitizeCSVRow)
          const valid = rows.filter(r => r.os_number)

          if (valid.length === 0) {
            toast('Nenhuma OS válida encontrada no CSV.', 'err')
            setImporting(false)
            return
          }

          await db.importOrders(valid)
          toast(`CSV importado — ${ptn(valid.length)} OS processadas!`)
        } catch (err) {
          console.error('Erro ao importar CSV:', err)
          toast('Erro ao importar CSV.', 'err')
        } finally {
          setImporting(false)
        }
      },
      error: (err) => {
        console.error('Erro ao ler CSV:', err)
        toast('Erro ao ler o CSV.', 'err')
        setImporting(false)
      },
    })
  }

  // ── Aliases ──────────────────────────────────────────────────
  async function saveAliases() {
    for (const [team, alias] of Object.entries(aliasEdits)) {
      await db.setTeamAlias(team, alias)
    }
    setAliasEdits({})
    toast('Apelidos salvos!')
  }

  // ── Purge ────────────────────────────────────────────────────
  async function handlePurge() {
    if (!purgeMonth) { toast('Selecione um mês.', 'err'); return }
    const [y, mo] = purgeMonth.split('-')
    const label = MONTH_NAMES[parseInt(mo)-1] + '/' + y
    const cnt = db.allOrders.filter(o => (o.executed_at||'').startsWith(purgeMonth)).length
    if (!cnt) { toast('Nenhuma OS neste mês.', 'err'); return }
    if (!confirm(`Remover ${cnt} OS executadas em ${label}?\n\nEsta ação não pode ser desfeita.`)) return
    await db.purgeByMonth(purgeMonth)
    setPurgeMonth('')
  }

  // Available months in data
  const months = Array.from(
    new Set(
      db.allOrders
        .map(o => (o.executed_at || '').slice(0, 7))
        .filter(Boolean)
    )
  ).sort()

  const allTeams = db.getTeams()
  const removedTeamsList = Array.from(db.removedTeams)

  if (db.loading) return <AppLayout><div style={{ padding:40, color:'var(--text2)' }}>Carregando…</div></AppLayout>

  if (db.userRole !== 'admin') return (
    <AppLayout>
      <Toast />
      <div className="empty-state">
        <div style={{ fontSize:'2rem', marginBottom:12 }}>🔒</div>
        <p>Esta área é restrita a administradores.</p>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <Toast />
      <input type="file" ref={fileRef} accept=".csv" style={{ display:'none' }} onChange={handleCSV} />

      {/* ── CSV Import ── */}
      <section style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:'.95rem', fontWeight:800, marginBottom:6 }}>Importar CSV</h3>
        <p style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
          Importe arquivos CSV exportados do sistema. OS duplicadas (mesmo Nº OS) são ignoradas automaticamente.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? '⏳ Importando…' : '↑ Importar CSV'}
        </button>
      </section>

      <div className="divider" />

      {/* ── Team Management ── */}
      <section style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:'.95rem', fontWeight:800, marginBottom:6 }}>Gerenciar Equipes</h3>
        <p style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
          Oculte temporariamente ou remova permanentemente equipes da dashboard.
        </p>

        {allTeams.map(t => {
          const hidden  = db.hiddenTeams.has(t)
          const alias   = db.getAlias(t)
          return (
            <div key={t} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', borderRadius:8,
              background:'var(--surface)', border:'1px solid var(--border)',
              marginBottom:6, opacity: hidden ? 0.5 : 1,
            }}>
              <div style={{ flex:1, fontSize:'.85rem' }}>
                {alias}
                {alias !== t && <span style={{ fontSize:'.72rem', color:'var(--text3)', marginLeft:6 }}>({t})</span>}
                {hidden && <span style={{ marginLeft:8, background:'rgba(255,107,107,.1)', color:'var(--accent2)', border:'1px solid rgba(255,107,107,.2)', borderRadius:6, padding:'2px 8px', fontSize:'.72rem', fontWeight:700 }}>oculta</span>}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {hidden
                  ? <button className="btn btn-success btn-xs" onClick={() => db.setTeamHidden(t, false).then(() => toast('"'+alias+'" exibida novamente.'))}>Mostrar</button>
                  : <button className="btn btn-ghost btn-xs" onClick={() => db.setTeamHidden(t, true).then(() => toast('"'+alias+'" ocultada.'))}>Ocultar</button>
                }
                <button className="btn btn-danger btn-xs"
                  onClick={async () => {
                    if (!confirm(`Remover "${alias}" da dashboard?`)) return
                    await db.setTeamRemoved(t, true)
                    toast('"'+alias+'" removida. Restaure abaixo.')
                  }}>
                  Remover
                </button>
              </div>
            </div>
          )
        })}

        {allTeams.length === 0 && <p style={{ fontSize:'.85rem', color:'var(--text2)', padding:12 }}>Nenhuma equipe.</p>}
      </section>

      {/* ── Restored Teams ── */}
      {removedTeamsList.length > 0 && (
        <>
          <div className="divider" />
          <section style={{ marginBottom:32 }}>
            <h3 style={{ fontSize:'.95rem', fontWeight:800, marginBottom:6 }}>Equipes Removidas</h3>
            <p style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:14 }}>Clique em Restaurar para reativá-las.</p>
            {removedTeamsList.map(t => (
              <div key={t} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', borderRadius:8,
                background:'var(--surface)', border:'1px solid var(--border)',
                marginBottom:6, opacity:0.5,
              }}>
                <div style={{ flex:1, fontSize:'.85rem' }}>{db.getAlias(t)} <span style={{ fontSize:'.72rem', color:'var(--text3)' }}>({t})</span></div>
                <button className="btn btn-success btn-xs"
                  onClick={async () => { await db.setTeamRemoved(t, false); toast('"'+db.getAlias(t)+'" restaurada.') }}>
                  ↺ Restaurar
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      <div className="divider" />

      {/* ── Aliases ── */}
      <section style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:'.95rem', fontWeight:800, marginBottom:6 }}>Apelidos de Equipe</h3>
        <p style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
          Defina nomes amigáveis exibidos na dashboard. O nome original do CSV é mantido internamente.
        </p>
        {allTeams.filter(t => !db.hiddenTeams.has(t)).map(t => (
          <div key={t} style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'9px 12px', borderRadius:8,
            background:'var(--surface)', border:'1px solid var(--border)', marginBottom:6,
          }}>
            <div style={{ flex:1, fontSize:'.78rem', color:'var(--text2)', minWidth:200 }}>{t}</div>
            <input
              className="input input-sm"
              style={{ maxWidth:300 }}
              placeholder="Apelido…"
              defaultValue={db.getAlias(t) !== t ? db.getAlias(t) : ''}
              onChange={e => setAliasEdits(prev => ({ ...prev, [t]: e.target.value }))}
            />
          </div>
        ))}
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary btn-sm" onClick={saveAliases}>✓ Salvar Apelidos</button>
        </div>
      </section>

      <div className="divider" />

      {/* ── Purge by month ── */}
      <section style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:'.95rem', fontWeight:800, marginBottom:6 }}>Remover OS por Mês</h3>
        <p style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
          Remove permanentemente todas as OS executadas no mês selecionado.
        </p>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <select
            className="input input-sm"
            style={{ width:'auto', minWidth:180 }}
            value={purgeMonth}
            onChange={e => setPurgeMonth(e.target.value)}
          >
            <option value="">Selecione o mês…</option>
            {months.map(m => {
              const [y, mo] = m.split('-')
              const label = MONTH_NAMES[parseInt(mo)-1] + '/' + y
              const cnt = db.allOrders.filter(o => (o.executed_at||'').startsWith(m)).length
              return <option key={m} value={m}>{label} — {ptn(cnt)} OS</option>
            })}
          </select>
          <button className="btn btn-danger btn-sm" onClick={handlePurge}>🗑 Remover OS deste mês</button>
        </div>
      </section>

      <div className="divider" />

      {/* ── User management info ── */}
      <section style={{ marginBottom:32 }}>
        <h3 style={{ fontSize:'.95rem', fontWeight:800, marginBottom:6 }}>Gerenciar Usuários</h3>
        <p style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
          Para convidar novos usuários ou alterar permissões, acesse o painel do Supabase em{' '}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>
            supabase.com/dashboard
          </a>{' '}
          → Authentication → Users.
          Após criar o usuário, altere o campo <code style={{ background:'var(--surface2)', padding:'1px 5px', borderRadius:4, fontFamily:'var(--mono)', fontSize:'.8rem' }}>role</code> na tabela <code style={{ background:'var(--surface2)', padding:'1px 5px', borderRadius:4, fontFamily:'var(--mono)', fontSize:'.8rem' }}>profiles</code> para <strong>admin</strong> ou <strong>viewer</strong>.
        </p>
      </section>

    </AppLayout>
  )
}