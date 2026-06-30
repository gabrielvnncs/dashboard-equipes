'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { applyFilters, computeTeamStats } from '@/lib/utils'
import type { WorkOrder, Score, TeamSetting, Filters, TeamStats } from '@/types'
import { toast } from '@/components/ui/Toast'
import { useUser } from '@/hooks/useUser'

const DEFAULT_FILTERS: Filters = {
  situacao: 'Executada',
  cidade: '',
  equipe: '',
  dateStart: '',
  dateEnd: '',
  activeTipos: new Set(),
}

export function useDashboard() {
  const supabase = createClient()

  // Raw data
  const [allOrders, setAllOrders]           = useState<WorkOrder[]>([])
  const [scores, setScores]                 = useState<Record<string, number>>({})
  const [teamSettings, setTeamSettings]     = useState<TeamSetting[]>([])
  const [removedServices, setRemovedServices] = useState<Set<string>>(new Set())

  // Derived
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([])
  const [teamStats, setTeamStats]           = useState<Record<string, TeamStats>>({})

  // UI state
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const { user: currentUser } = useUser()
  const userRole = currentUser?.role || 'viewer'

  const hiddenTeams  = new Set(teamSettings.filter(t => t.hidden).map(t => t.team))
  const removedTeams = new Set(teamSettings.filter(t => t.removed).map(t => t.team))

  function getAlias(team: string) {
    return teamSettings.find(t => t.team === team)?.alias || team
  }

  // ── Load everything ──────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { data: orders },
        { data: scrs }  ,
        { data: teams } ,
        { data: rsvc }  ,
      ] = await Promise.all([
        supabase.from('work_orders').select('*').order('executed_at', { ascending: false }),
        supabase.from('scores').select('*'),
        supabase.from('team_settings').select('*'),
        supabase.from('removed_services').select('service'),
      ])

      setAllOrders(orders || [])

      const scMap: Record<string, number> = {}
      ;(scrs || []).forEach((s: Score) => { scMap[s.service] = Number(s.points) })
      setScores(scMap)

      setTeamSettings(teams || [])
      setRemovedServices(new Set((rsvc || []).map((r: { service: string }) => r.service)))

      // Expande o range de datas para sempre cobrir todas as OS do banco
      if (orders?.length) {
        const dates = orders
          .map((o: WorkOrder) => o.executed_at)
          .filter(Boolean)
          .sort() as string[]
        const minDate = dates[0] || ''
        const maxDate = dates[dates.length - 1] || ''
        setFilters(prev => ({
          ...prev,
          dateStart: prev.dateStart && prev.dateStart < minDate ? prev.dateStart : minDate,
          dateEnd:   prev.dateEnd   && prev.dateEnd   > maxDate ? prev.dateEnd   : maxDate,
        }))
      }
    } catch (err) {
      toast('Erro ao carregar dados.', 'err')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Recompute filtered + stats when data or filters change ───
  useEffect(() => {
    const excludedTeams = new Set([
      ...Array.from(hiddenTeams),
      ...Array.from(removedTeams)
    ])

    const filtered = applyFilters(
      allOrders,
      filters,
      excludedTeams
    )

    setFilteredOrders(filtered)

    setTeamStats(
      computeTeamStats(
        filtered,
        scores,
        removedServices,
        excludedTeams
      )
    )
  }, [allOrders, filters, scores, teamSettings, removedServices])

  // ── Score update ─────────────────────────────────────────────
  async function updateScore(service: string, points: number) {
    setScores(prev => ({ ...prev, [service]: points }))
    await supabase.from('scores').upsert({ service, points })
  }

  // ── Team settings ────────────────────────────────────────────
  async function setTeamHidden(team: string, hidden: boolean) {
    const existing = teamSettings.find(t => t.team === team)
    const upsert: Partial<TeamSetting> = existing
      ? { ...existing, hidden }
      : { team, hidden, removed: false, is_custom: false }

    setTeamSettings(prev =>
      prev.some(t => t.team === team)
        ? prev.map(t => t.team === team ? { ...t, hidden } : t)
        : [...prev, upsert as TeamSetting]
    )
    await supabase.from('team_settings').upsert(upsert)
  }

  async function setTeamRemoved(team: string, removed: boolean) {
    const existing = teamSettings.find(t => t.team === team)
    const upsert: Partial<TeamSetting> = existing
      ? { ...existing, removed, hidden: false }
      : { team, removed, hidden: false, is_custom: false }

    setTeamSettings(prev =>
      prev.some(t => t.team === team)
        ? prev.map(t => t.team === team ? { ...t, removed, hidden: false } : t)
        : [...prev, upsert as TeamSetting]
    )
    await supabase.from('team_settings').upsert(upsert)
  }

  async function setTeamAlias(team: string, alias: string) {
    setTeamSettings(prev =>
      prev.map(t => t.team === team ? { ...t, alias } : t)
    )
    await supabase.from('team_settings').upsert({
      team,
      alias,
      hidden: hiddenTeams.has(team),
      removed: removedTeams.has(team),
      is_custom: teamSettings.find(t => t.team === team)?.is_custom || false,
    })
  }

  async function addCustomTeam(team: string, alias?: string) {
    const upsert: TeamSetting = { team, alias: alias || null, hidden: false, removed: false, is_custom: true }
    setTeamSettings(prev => [...prev.filter(t => t.team !== team), upsert])
    await supabase.from('team_settings').upsert(upsert)
  }

  // ── Service blacklist ────────────────────────────────────────
  async function removeService(service: string) {
    setRemovedServices(prev => new Set([...Array.from(prev), service]))
    setScores(prev => { const n = { ...prev }; delete n[service]; return n })
    await supabase.from('removed_services').upsert({ service })
    await supabase.from('scores').delete().eq('service', service)
  }

  // ── Purge by month ───────────────────────────────────────────
  async function purgeByMonth(monthKey: string) {
    const { error } = await supabase
      .from('work_orders')
      .delete()
      .like('executed_at', `${monthKey}%`)
    if (error) { toast('Erro ao remover OS.', 'err'); return }
    setAllOrders(prev => prev.filter(o => !(o.executed_at || '').startsWith(monthKey)))
    toast('OS removidas!')
  }

  // ── CSV import (upsert batch) ────────────────────────────────
  async function importOrders(rows: Partial<WorkOrder>[]) {
    const BATCH = 500
    let added = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { data, error } = await supabase
        .from('work_orders')
        .upsert(batch, { onConflict: 'os_number', ignoreDuplicates: true })
        .select('id')
      if (!error && data) added += data.length

      // auto-discover new services → add to scores with default 1
      batch.forEach(r => {
        if (r.service && scores[r.service] === undefined) {
          updateScore(r.service, 1)
        }
      })
    }
    await loadAll()
    return added
  }

  // ── All teams (visible + custom, not removed) ────────────────
  function getTeams() {
    const fromData = Array.from(new Set(allOrders.map(o => o.team).filter(Boolean))) as string[]
    const customTs = teamSettings.filter(t => t.is_custom).map(t => t.team)
    return Array.from(new Set([...fromData, ...customTs]))
      .filter(t => !removedTeams.has(t))
      .sort()
  }

  function getVisibleTeams() {
    return getTeams().filter(t => !hiddenTeams.has(t))
  }

  return {
    // data
    allOrders, filteredOrders, scores, teamSettings, removedServices,
    teamStats, loading, userRole,
    // derived
    hiddenTeams, removedTeams,
    // helpers
    getAlias, getTeams, getVisibleTeams,
    // actions
    loadAll, setFilters, filters,
    updateScore, setTeamHidden, setTeamRemoved, setTeamAlias,
    addCustomTeam, removeService, purgeByMonth, importOrders,
  }
}