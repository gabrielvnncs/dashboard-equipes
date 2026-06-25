// ── Banco de dados ───────────────────────────────────────────────
export interface WorkOrder {
  id: number
  os_number: string
  os_id: string | null
  team: string | null
  service: string | null
  status: string | null
  executed_at: string | null   // ISO date "2026-04-26"
  city: string | null
  service_type: string | null
  service_type2: string | null
  imported_at: string
}

export interface Score {
  service: string
  points: number
}

export interface TeamSetting {
  team: string
  alias: string | null
  hidden: boolean
  removed: boolean
  is_custom: boolean
}

export interface Profile {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'viewer'
  created_at: string
}

// ── App state ────────────────────────────────────────────────────
export interface TeamStats {
  total: number
  os_count: number
  services: Record<string, number>
  tipos: Record<string, number>
}

export interface Filters {
  situacao: string
  cidade: string
  equipe: string
  dateStart: string
  dateEnd: string
  activeTipos: Set<string>
}

// ── CSV ──────────────────────────────────────────────────────────
export interface CSVRow {
  'Nº OS'?: string
  'ID OS'?: string
  'Equipe Executada'?: string
  'Serviço'?: string
  'Situação'?: string
  'Execução'?: string
  'Cidade'?: string
  'Tipo Serviço'?: string
  'Tipo Serviço Classificado'?: string
  [key: string]: string | undefined
}

export const VALID_CITIES: Record<string, string> = {
  LINS: 'Lins',
  PROMISSAO: 'Promissão',
  GUAICARA: 'Guaiçara',
}

export const ALLOWED_COLUMNS = new Set([
  'Nº OS', 'ID OS', 'Equipe Executada', 'Serviço', 'Situação',
  'Execução', 'Cidade', 'Tipo Serviço', 'Tipo Serviço Classificado',
])

export const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export const CHART_COLORS = [
  '#5b7fff','#43e8b0','#ff6b6b','#ffc857','#c084fc',
  '#fb923c','#38bdf8','#f472b6','#a3e635','#e879f9',
  '#06b6d4','#f59e0b',
]

export const DEFAULT_SCORES: Record<string, number> = {
  'PRIMEIRA CONEXAO DO ASSINANTE': 10,
  'ASSISTENCIA - VT 24H': 5,
  'ALTERACAO DE PROGRAMACAO - UPGRADE': 4,
  'TRANSF. DE ENDERECO SINGLE': 6,
  'TROCAR CABEAMENTO': 5,
  'RETIRADA DE EQUIPAMENTO': 3,
  'EQUIPAMENTO - TROCA': 5,
  'CONTRATO - CANCELAMENTO INTERNET': 2,
  'ALTERACAO DE PROGRAMACAO - MESMO VALOR': 3,
  'REDE - MANUTENCAO CAIXA SECUNDARIA': 8,
  'LIBERACAO DE CONFIANCA': 2,
  'CABONNET PLAY - HABILITACAO': 4,
  'REDE - MANUTENCAO ACOMPANHAMENTO': 7,
  'INS - ALTERACAO': 4,
  'CABONNET PLAY - CANCELAMENTO': 2,
  'CONF. ROTEADOR COMODATO': 3,
  'EXITLAG - HABILITACAO': 3,
  'TROCA DE POSTES': 8,
  'QUALIDADE E EXECUCAO': 5,
  'INADIMPLENCIA - RECONEXAO MANUAL': 2,
}
