import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function mesAno(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
function ultimos6Meses() {
  const meses = []
  const hoje = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
  }
  return meses
}

const STATUS_LABEL = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  cancelado: 'Cancelado', aguardando_prestacao: 'Aguard. Prestação',
  prestacao_entregue: 'Prestação Entregue',
  revisao_interna: 'Revisão Interna', ajustes: 'Ajustes',
  enviado_unesco: 'Enviado UNESCO', retorno_unesco: 'Retorno UNESCO',
  adiantamento_recursos: 'Adiantamento', pequenas_compras: 'Pequenas Compras',
}
const STATUS_COR = {
  rascunho: '#9ca3af', enviado: '#3b82f6', aprovado: '#22c55e',
  cancelado: '#ef4444', aguardando_prestacao: '#f59e0b',
  prestacao_entregue: '#10b981', revisao_interna: '#8b5cf6',
  ajustes: '#f97316', enviado_unesco: '#06b6d4', retorno_unesco: '#f59e0b',
}
const MODULO_COR = { 'Diárias': '#2d7a4f', 'Aquisições': '#b45309', 'TDRs': '#1d4ed8' }

// ── componente principal ──────────────────────────────────────────────────────
export default function Financeiro({ perfilUsuario }) {
  const [diarias,   setDiarias]   = useState([])
  const [aquisicoes, setAquisicoes] = useState([])
  const [tdrs,      setTdrs]      = useState([])
  const [unidades,  setUnidades]  = useState([])
  const [carregando, setCarregando] = useState(true)

  // filtros
  const [filtroModulo,  setFiltroModulo]  = useState('todos')
  const [filtroStatus,  setFiltroStatus]  = useState('todos')
  const [filtroUO,      setFiltroUO]      = useState('todos')
  const [filtroDemanda, setFiltroDemanda] = useState('')
  const [filtroDataDe,  setFiltroDataDe]  = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')

  const carregar = async () => {
    setCarregando(true)
    const [{ data: d }, { data: a }, { data: t }, { data: u }] = await Promise.all([
      supabase.from('passagens_diarias').select('*, unidade:unidades(nome,instituicao)').neq('status', 'rascunho'),
      supabase.from('aquisicoes').select('*, unidade:unidades(nome,instituicao)').neq('status', 'cancelado'),
      supabase.from('tdrs').select('*, unidade:unidades(nome,instituicao)').neq('status', 'cancelado'),
      supabase.from('unidades').select('*').order('nome'),
    ])
    setDiarias(d || [])
    setAquisicoes(a || [])
    setTdrs(t || [])
    setUnidades(u || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  // ── normalizar linhas unificadas ─────────────────────────────────────────
  const linhas = useMemo(() => {
    const resultado = []

    diarias.forEach(r => {
      const dados = r.dados || {}
      // tenta extrair valor de diária dos dados
      const valor = 0 // passagens não têm valor monetário direto no campo
      resultado.push({
        modulo: 'Diárias',
        id: r.id,
        demanda: dados.numero_rpad || r.numero_rpad || '—',
        descricao: dados.nome_beneficiario || dados.nome || '—',
        uo: r.unidade?.nome || '—',
        unidade_id: r.unidade_id,
        status: r.status,
        valor,
        data: r.created_at,
      })
    })

    aquisicoes.forEach(r => {
      const valor = (r.itens || []).reduce((s, it) => s + Number(it.valor || 0), 0)
      resultado.push({
        modulo: 'Aquisições',
        id: r.id,
        demanda: r.numero_demanda || '—',
        descricao: MODULO_COR['Aquisições'] ? (r.tipo === 'adiantamento_recursos' ? 'Adiantamento de Recursos' : 'Pequenas Compras') : '—',
        uo: r.unidade?.nome || '—',
        unidade_id: r.unidade_id,
        status: r.status,
        valor,
        data: r.created_at,
      })
    })

    tdrs.forEach(r => {
      const valor = Number(r.valor_brl || 0)
      resultado.push({
        modulo: 'TDRs',
        id: r.id,
        demanda: r.numero || '—',
        descricao: r.objeto ? r.objeto.slice(0, 60) + (r.objeto.length > 60 ? '…' : '') : '—',
        uo: r.unidade?.nome || '—',
        unidade_id: r.unidade_id,
        status: r.status,
        valor,
        valor_usd: Number(r.valor_usd || 0),
        data: r.created_at,
      })
    })

    return resultado.sort((a, b) => new Date(b.data) - new Date(a.data))
  }, [diarias, aquisicoes, tdrs])

  // ── aplicar filtros ──────────────────────────────────────────────────────
  const filtradas = useMemo(() => linhas.filter(l => {
    const moduloOk  = filtroModulo  === 'todos' || l.modulo === filtroModulo
    const statusOk  = filtroStatus  === 'todos' || l.status === filtroStatus
    const uoOk      = filtroUO      === 'todos' || l.unidade_id === filtroUO
    const demandaOk = !filtroDemanda || l.demanda.toLowerCase().includes(filtroDemanda.toLowerCase())
    const dataDeOk  = !filtroDataDe  || new Date(l.data) >= new Date(filtroDataDe)
    const dataAteOk = !filtroDataAte || new Date(l.data) <= new Date(filtroDataAte + 'T23:59:59')
    return moduloOk && statusOk && uoOk && demandaOk && dataDeOk && dataAteOk
  }), [linhas, filtroModulo, filtroStatus, filtroUO, filtroDemanda, filtroDataDe, filtroDataAte])

  // ── totais ───────────────────────────────────────────────────────────────
  const totalAquisicoes = aquisicoes.reduce((s, a) =>
    s + (a.itens || []).reduce((si, it) => si + Number(it.valor || 0), 0), 0)
  const totalTdrsBrl = tdrs.reduce((s, t) => s + Number(t.valor_brl || 0), 0)
  const totalTdrsUsd = tdrs.reduce((s, t) => s + Number(t.valor_usd || 0), 0)
  const totalGeral   = totalAquisicoes + totalTdrsBrl

  // ── dados para gráficos ──────────────────────────────────────────────────
  const dadosPizza = [
    { name: 'Aquisições', value: totalAquisicoes },
    { name: 'TDRs (R$)',  value: totalTdrsBrl },
  ].filter(d => d.value > 0)

  const meses = ultimos6Meses()
  const dadosBarras = meses.map(mes => {
    const aq = aquisicoes
      .filter(a => mesAno(a.created_at) === mes)
      .reduce((s, a) => s + (a.itens || []).reduce((si, it) => si + Number(it.valor || 0), 0), 0)
    const td = tdrs
      .filter(t => mesAno(t.created_at) === mes)
      .reduce((s, t) => s + Number(t.valor_brl || 0), 0)
    return { mes, Aquisições: aq, TDRs: td }
  })

  const statusTdrs = ['rascunho','revisao_interna','ajustes','enviado_unesco','retorno_unesco','aprovado']
    .map(s => ({ name: STATUS_LABEL[s] || s, value: tdrs.filter(t => t.status === s).length }))
    .filter(d => d.value > 0)

  const limparFiltros = () => {
    setFiltroModulo('todos'); setFiltroStatus('todos'); setFiltroUO('todos')
    setFiltroDemanda(''); setFiltroDataDe(''); setFiltroDataAte('')
  }
  const temFiltro = filtroModulo !== 'todos' || filtroStatus !== 'todos' || filtroUO !== 'todos' ||
    filtroDemanda || filtroDataDe || filtroDataAte

  if (carregando) return <p style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Carregando...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Cards de totais ── */}
      <div style={styles.statsGrid}>
        <StatCard
          titulo="TOTAL GERAL (R$)"
          valor={`R$ ${fmtMoeda(totalGeral)}`}
          sub={`${linhas.length} registros ativos`}
          cor="#1a4731"
          grande
        />
        <StatCard
          titulo="DIÁRIAS"
          valor={diarias.length}
          sub={`${diarias.filter(d => d.status === 'aprovado' || d.status === 'aguardando_prestacao' || d.status === 'prestacao_entregue').length} aprovadas`}
          cor="#2d7a4f"
          icone="✈️"
        />
        <StatCard
          titulo="AQUISIÇÕES (R$)"
          valor={`R$ ${fmtMoeda(totalAquisicoes)}`}
          sub={`${aquisicoes.length} pacotes`}
          cor="#b45309"
          icone="🛒"
        />
        <StatCard
          titulo="TDRs (R$)"
          valor={`R$ ${fmtMoeda(totalTdrsBrl)}`}
          sub={`U$ ${fmtMoeda(totalTdrsUsd)} · ${tdrs.length} TDRs`}
          cor="#1d4ed8"
          icone="📄"
        />
        <StatCard
          titulo="APROVADOS"
          valor={aquisicoes.filter(a => a.status === 'aprovado').length + tdrs.filter(t => t.status === 'aprovado').length}
          sub="aquisições + TDRs"
          cor="#059669"
          icone="✅"
        />
      </div>

      {/* ── Gráficos ── */}
      <div style={styles.graficosGrid}>

        {/* Pizza — distribuição por módulo */}
        <div style={styles.graficoCard}>
          <h3 style={styles.graficoTitulo}>Distribuição por Módulo (R$)</h3>
          {dadosPizza.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dadosPizza} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`}>
                  {dadosPizza.map((entry, i) => (
                    <Cell key={i} fill={i === 0 ? '#b45309' : '#1d4ed8'} />
                  ))}
                </Pie>
                <RTooltip formatter={v => `R$ ${fmtMoeda(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={styles.semDados}>Sem valores registrados</p>
          )}
        </div>

        {/* Barras — evolução mensal */}
        <div style={{ ...styles.graficoCard, flex: 2 }}>
          <h3 style={styles.graficoTitulo}>Evolução Mensal — últimos 6 meses (R$)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosBarras} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : `${(v/1000).toFixed(0)}k`} />
              <RTooltip formatter={v => `R$ ${fmtMoeda(v)}`} />
              <Legend />
              <Bar dataKey="Aquisições" fill="#b45309" radius={[4,4,0,0]} />
              <Bar dataKey="TDRs"       fill="#1d4ed8" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Barras horizontais — TDRs por status */}
        <div style={styles.graficoCard}>
          <h3 style={styles.graficoTitulo}>TDRs por Status</h3>
          {statusTdrs.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusTdrs} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <RTooltip />
                <Bar dataKey="value" name="Qtd." fill="#1d4ed8" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={styles.semDados}>Nenhum TDR registrado</p>
          )}
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={styles.filtrosCard}>
        <div style={styles.filtrosLinha}>
          <select style={styles.sel} value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}>
            <option value="todos">Todos os módulos</option>
            <option value="Diárias">Diárias</option>
            <option value="Aquisições">Aquisições</option>
            <option value="TDRs">TDRs</option>
          </select>

          <select style={styles.sel} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {['enviado','aprovado','cancelado','aguardando_prestacao','prestacao_entregue',
              'revisao_interna','ajustes','enviado_unesco','retorno_unesco'].map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
            ))}
          </select>

          <select style={styles.sel} value={filtroUO} onChange={e => setFiltroUO(e.target.value)}>
            <option value="todos">Todas as UOs</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>

          <input style={styles.inp} value={filtroDemanda}
            onChange={e => setFiltroDemanda(e.target.value)}
            placeholder="Filtrar por demanda..." />

          <input style={styles.inp} type="date" value={filtroDataDe}
            onChange={e => setFiltroDataDe(e.target.value)} title="Data inicial" />
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>até</span>
          <input style={styles.inp} type="date" value={filtroDataAte}
            onChange={e => setFiltroDataAte(e.target.value)} title="Data final" />

          {temFiltro && (
            <button onClick={limparFiltros} style={styles.btnLimpar}>✕ Limpar</button>
          )}
          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {filtradas.length} de {linhas.length} registros
          </span>
        </div>
      </div>

      {/* ── Tabela unificada ── */}
      <div style={styles.tabelaCard}>
        <h3 style={styles.tabelaTitulo}>Detalhamento</h3>
        {filtradas.length === 0 ? (
          <p style={styles.semDados}>Nenhum registro encontrado para os filtros aplicados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.tabela}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <Th>Módulo</Th>
                  <Th>Demanda</Th>
                  <Th>Descrição</Th>
                  <Th>UO</Th>
                  <Th>Status</Th>
                  <Th right>Valor (R$)</Th>
                  <Th>Data</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l, i) => (
                  <tr key={`${l.modulo}-${l.id}`}
                    style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f3f4f6' }}>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.moduloBadge,
                        background: MODULO_COR[l.modulo] + '18',
                        color: MODULO_COR[l.modulo],
                      }}>
                        {l.modulo}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: '600', color: '#111827' }}>{l.demanda}</td>
                    <td style={{ ...styles.td, color: '#6b7280', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao}</td>
                    <td style={styles.td}>{l.uo}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        background: (STATUS_COR[l.status] || '#9ca3af') + '20',
                        color: STATUS_COR[l.status] || '#9ca3af',
                      }}>
                        {STATUS_LABEL[l.status] || l.status}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                      {l.modulo === 'Diárias' ? '—' : `R$ ${fmtMoeda(l.valor)}`}
                      {l.valor_usd > 0 && <div style={{ fontSize: '11px', color: '#6b7280' }}>U$ {fmtMoeda(l.valor_usd)}</div>}
                    </td>
                    <td style={{ ...styles.td, color: '#9ca3af' }}>{fmtData(l.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Rodapé com total filtrado */}
            {filtradas.some(l => l.valor > 0) && (
              <div style={styles.tabelaRodape}>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>
                  Total dos registros exibidos:
                </span>
                <strong style={{ color: '#1a4731', fontSize: '15px' }}>
                  R$ {fmtMoeda(filtradas.reduce((s, l) => s + (l.valor || 0), 0))}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── sub-componentes ───────────────────────────────────────────────────────────
function StatCard({ titulo, valor, sub, cor, icone, grande }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `4px solid ${cor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', color: cor, letterSpacing: '0.5px', margin: 0 }}>{titulo}</p>
        {icone && <span style={{ fontSize: '20px' }}>{icone}</span>}
      </div>
      <p style={{ fontSize: grande ? '20px' : '28px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0', lineHeight: 1.2 }}>{valor}</p>
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{sub}</p>
    </div>
  )
}

function Th({ children, right }) {
  return (
    <th style={{
      padding: '10px 16px', textAlign: right ? 'right' : 'left',
      fontSize: '11px', fontWeight: '700', color: '#9ca3af',
      textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

// ── estilos ───────────────────────────────────────────────────────────────────
const styles = {
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
  },
  graficosGrid: {
    display: 'flex', gap: '16px', flexWrap: 'wrap',
  },
  graficoCard: {
    flex: 1, minWidth: '260px', background: '#fff', borderRadius: '12px',
    padding: '20px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  graficoTitulo: {
    fontSize: '14px', fontWeight: '700', color: '#374151',
    margin: '0 0 16px 0',
  },
  semDados: {
    textAlign: 'center', color: '#9ca3af', fontSize: '14px',
    padding: '40px 0',
  },
  filtrosCard: {
    background: '#fff', borderRadius: '12px', padding: '14px 18px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  filtrosLinha: {
    display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
  },
  sel: {
    padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  inp: {
    padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db',
    fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '140px',
  },
  btnLimpar: {
    padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
    background: 'white', cursor: 'pointer', fontSize: '12px', color: '#6b7280',
  },
  tabelaCard: {
    background: '#fff', borderRadius: '12px', padding: '20px 0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
  },
  tabelaTitulo: {
    fontSize: '15px', fontWeight: '700', color: '#111827',
    margin: '0 0 16px 0', padding: '0 20px',
  },
  tabela: {
    width: '100%', borderCollapse: 'collapse', fontSize: '13px',
  },
  td: {
    padding: '11px 16px', color: '#374151', verticalAlign: 'middle',
  },
  moduloBadge: {
    padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
    fontWeight: '700', whiteSpace: 'nowrap',
  },
  statusBadge: {
    padding: '3px 8px', borderRadius: '12px', fontSize: '11px',
    fontWeight: '600', whiteSpace: 'nowrap',
  },
  tabelaRodape: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: '12px', padding: '12px 20px', borderTop: '2px solid #f3f4f6',
    background: '#f9fafb',
  },
}
