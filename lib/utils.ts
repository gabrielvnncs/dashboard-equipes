import type { WorkOrder, TeamStats, Filters } from '@/types'
import { ALLOWED_COLUMNS } from '@/types'

// ── Formatação ───────────────────────────────────────────────────
export function ptn(n: number): string {
  return Number(n).toLocaleString('pt-BR')
}

export function ptnd(n: number): string {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function trunc(s: string, n: number): string {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Datas ────────────────────────────────────────────────────────
export function parseExecutionDate(raw: string): string {
  // Aceita "2026-04-26 00:00:00" ou "2026-04-26"
  const m = (raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

export function getMonthKey(dateStr: string): string {
  const m = (dateStr || '').trim().match(/^(\d{4}-\d{2})/)
  return m ? m[1] : ''
}

// ── CSV ──────────────────────────────────────────────────────────
export function sanitizeCSVRow(obj: Record<string, string>): Partial<WorkOrder> {
  const clean: Record<string, string> = {}
  ALLOWED_COLUMNS.forEach((col) => {
    if (obj[col] !== undefined) clean[col] = obj[col]
  })

  // Ignora OS que não foram executadas
  if (clean['Situação'] !== 'Executada') {
    return { os_number: '' }
  }

  const execRaw = clean['Execução'] || ''
  const execDate = parseExecutionDate(execRaw)

  return {
    os_number:     clean['Nº OS']                    || '',
    os_id:         clean['ID OS']                    || null,
    team:          clean['Equipe Executada']          || null,
    service:       clean['Serviço']                  || null,
    status:        clean['Situação']                 || null,
    executed_at:   execDate                          || null,
    city:          clean['Cidade']                   || null,
    service_type:  clean['Tipo Serviço']             || null,
    service_type2: clean['Tipo Serviço Classificado']|| null,
  }
}

// ── Stats ────────────────────────────────────────────────────────
export function computeTeamStats(
  data: WorkOrder[],
  scores: Record<string, number>,
  removedServices: Set<string>,
  hiddenTeams: Set<string>
): Record<string, TeamStats> {
  const stats: Record<string, TeamStats> = {}
  const seenOS: Record<string, Set<string>> = {}

  data.forEach((r) => {
    const t = r.team
    if (!t || hiddenTeams.has(t)) return

    if (!stats[t]) {
      stats[t] = { total: 0, os_count: 0, services: {}, tipos: {} }
      seenOS[t] = new Set()
    }

    // Dedup por OS
    if (r.os_number) {
      if (seenOS[t].has(r.os_number)) return
      seenOS[t].add(r.os_number)
    }

    stats[t].os_count++

    const tp = r.service_type || 'OUTRO'
    stats[t].tipos[tp] = (stats[t].tipos[tp] || 0) + 1

    const s = r.service
    if (s && !removedServices.has(s)) {
      stats[t].services[s] = (stats[t].services[s] || 0) + 1
      stats[t].total += scores[s] ?? 1
    }
  })

  return stats
}

// ── Filtros ──────────────────────────────────────────────────────
export function applyFilters(data: WorkOrder[], filters: Filters, hiddenTeams: Set<string>): WorkOrder[] {
  return data.filter((r) => {
    if (filters.situacao && r.status !== filters.situacao) return false
    if (filters.cidade && r.city !== filters.cidade) return false
    if (filters.equipe && r.team !== filters.equipe) return false
    if (hiddenTeams.has(r.team || '')) return false
    if (filters.activeTipos.size > 0 && !filters.activeTipos.has(r.service_type || '')) return false
    if (filters.dateStart || filters.dateEnd) {
      const d = r.executed_at || ''
      if (filters.dateStart && d < filters.dateStart) return false
      if (filters.dateEnd && d > filters.dateEnd) return false
    }
    return true
  })
}

// ── Export CSV ───────────────────────────────────────────────────
export function exportRankingCSV(
  stats: Record<string, TeamStats>,
  aliases: Record<string, string>
): void {
  const teams = Object.keys(stats)
    .filter((t) => stats[t].os_count > 0)
    .sort((a, b) => stats[b].total - stats[a].total)

  const rows = [['Posição', 'Equipe', 'OS Executadas', 'Tipos de Serviço', 'Pontuação Total']]
  teams.forEach((t, i) => {
    const st = stats[t]
    rows.push([
      String(i + 1),
      aliases[t] || t,
      String(st.os_count),
      String(Object.keys(st.services).length),
      String(st.total),
    ])
  })

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ranking_equipes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}