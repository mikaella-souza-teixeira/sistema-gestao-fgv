import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ModalTDR from '../components/ModalTDR'
import { downloadArquivo } from '../lib/downloads'

const STATUS_COR = {
  rascunho: { bg: '#f3f4f6', cor: '#6b7280', label: 'Rascunho' },
  aprovado: { bg: '#dcfce7', cor: '#166534', label: 'Aprovado' },
  cancelado:{ bg: '#fee2e2', cor: '#991b1b', label: 'Cancelado' },
}

const TIPO_COR = {
  PF: { bg: '#dbeafe', cor: '#1e40af' },
  PJ: { bg: '#fef3c7', cor: '#92400e' },
}

const ETAPAS = [
  { key: 'tdr',       label: 'TDR',       icon: '📝' },
  { key: 'aquisicao', label: 'Aquisição', icon: '🛒' },
  { key: 'contrato',  label: 'Contrato',  icon: '📑' },
  { key: 'produtos',  label: 'Produtos',  icon: '📦' },
]

function fmtMoeda(valor) {
  if (!valor) return '—'
  return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default function TDRs({ perfilUsuario }) {
  const [tdrs, setTdrs]             = useState([])
  const [carregando, setCarregando] = useState(true)
  const [vista, setVista]           = useState('lista') // 'lista' | 'form'
  const [selecionado, setSelecionado] = useState(null)

  // Filtros
  const [busca, setBusca]               = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo]     = useState('PF+PJ')

  const carregar = async () => {
    setCarregando(true)
    const { data } = await supabase
      .from('tdrs')
      .select('*')
      .order('created_at', { ascending: false })
    setTdrs(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const toggleUrgente = async (id, atual) => {
    await supabase.from('tdrs').update({ urgente: !atual, updated_at: new Date().toISOString() }).eq('id', id)
    carregar()
  }

  const abrirNovo   = () => { setSelecionado(null); setVista('form') }
  const abrirEditar = (t) => { setSelecionado(t);  setVista('form') }
  const voltar      = () => { setVista('lista'); setSelecionado(null) }
  const aoSalvar    = () => { voltar(); carregar() }

  // Filtrar lista
  const tdrsFiltrados = tdrs.filter(t => {
    const q = busca.toLowerCase()
    const buscaOk = !busca ||
      (t.numero || '').toLowerCase().includes(q) ||
      (t.numero_demanda || '').toLowerCase().includes(q) ||
      (t.objeto || '').toLowerCase().includes(q)
    const statusOk = filtroStatus === 'todos' || (t.etapa || 'tdr') === filtroStatus
    const tipoOk   = filtroTipo === 'PF+PJ' || t.tipo === filtroTipo
    return buscaOk && statusOk && tipoOk
  })

  // Stats
  const hoje        = new Date()
  const total       = tdrs.length
  const aprovados   = tdrs.filter(t => t.etapa === 'aquisicao' || t.etapa === 'contrato' || t.etapa === 'produtos' || t.status === 'aprovado').length
  const emTDR       = tdrs.filter(t => !t.etapa || t.etapa === 'tdr').length
  const comContrato = tdrs.filter(t => t.etapa === 'contrato' || t.etapa === 'produtos').length
  const atrasados   = tdrs.filter(t => t.prazo_limite && new Date(t.prazo_limite) < hoje && t.status !== 'cancelado' && t.etapa === 'tdr').length
  const valorTotal  = tdrs.filter(t => t.status !== 'cancelado').reduce((s, t) => s + Number(t.valor_brl || 0), 0)

  // Vista: formulário de edição/criação (página inteira)
  if (vista === 'form') {
    return (
      <ModalTDR
        tdr={selecionado}
        perfilUsuario={perfilUsuario}
        onVoltar={voltar}
        onSalvar={aoSalvar}
      />
    )
  }

  return (
    <div>
      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard titulo="TOTAL" valor={total} sub={`${aprovados} avançaram de etapa`} cor="#1a4731" />
        <StatCard titulo="EM TDR" valor={emTDR} sub="aguardando aprovação" cor="#6b7280" />
        <StatCard titulo="COM CONTRATO" valor={comContrato} sub="contrato / produtos" cor="#5b21b6" />
        <StatCard titulo="ATRASADOS" valor={atrasados} sub="prazo vencido (TDR)" cor="#dc2626" />
        <StatCard titulo="VALOR TOTAL" valor={`R$ ${fmtMoeda(valorTotal)}`} sub="contratações ativas" cor="#92400e" grande />
      </div>

      {/* Barra de filtros */}
      <div style={styles.filtrosBarra}>
        <input
          style={styles.buscaInput}
          value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar número, demanda ou objeto..." />
        <select style={styles.filtroSelect} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todas as etapas</option>
          {ETAPAS.map(e => (
            <option key={e.key} value={e.key}>{e.icon} {e.label}</option>
          ))}
        </select>
        <select style={styles.filtroSelect} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="PF+PJ">PF + PJ</option>
          <option value="PF">Apenas PF</option>
          <option value="PJ">Apenas PJ</option>
        </select>
        <span style={styles.contagem}>{tdrsFiltrados.length} de {total}</span>
        <button onClick={abrirNovo} style={styles.btnNovo}>+ Nova Contratação</button>
      </div>

      {/* Lista de TDRs */}
      {carregando ? (
        <p style={styles.mensagem}>Carregando...</p>
      ) : tdrsFiltrados.length === 0 ? (
        <div style={styles.vazio}>
          <p style={styles.vazioPrimario}>Nenhuma contratação encontrada</p>
          <p style={styles.vazioSecundario}>
            {busca || filtroStatus !== 'todos' || filtroTipo !== 'PF+PJ'
              ? 'Tente limpar os filtros'
              : 'Clique em "+ Nova Contratação" para começar'}
          </p>
        </div>
      ) : (
        <div style={styles.lista}>
          {tdrsFiltrados.map(t => {
            const corTipo  = TIPO_COR[t.tipo] || TIPO_COR.PF
            const etapaAtual = t.etapa || 'tdr'
            const idxEtapa   = ETAPAS.findIndex(e => e.key === etapaAtual)
            const atrasado   = t.prazo_limite && new Date(t.prazo_limite) < hoje && etapaAtual === 'tdr' && t.status !== 'cancelado'
            return (
              <div key={t.id} style={{
                ...styles.card,
                borderLeft: t.urgente ? '4px solid #dc2626' : atrasado ? '4px solid #f97316' : '4px solid #e5e7eb',
                background:  t.urgente ? '#fff5f5' : '#fff'
              }}>
                {/* Linha 1: número + demanda + tipo + etapa */}
                <div style={styles.cardTopo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                    {t.urgente && <span style={styles.urgenteTag}>🚨 URGENTE</span>}
                    <span style={styles.numero}>{t.numero || 'S/N'}</span>
                    {t.numero_demanda && (
                      <span style={{ ...styles.badge, background: '#dbeafe', color: '#1e40af' }}>
                        📋 {t.numero_demanda}
                      </span>
                    )}
                    <span style={{ ...styles.badge, background: corTipo.bg, color: corTipo.cor }}>{t.tipo}</span>
                    {atrasado && <span style={{ ...styles.badge, background: '#ffedd5', color: '#9a3412' }}>⚠ Atrasado</span>}
                    {t.status === 'cancelado' && <span style={{ ...styles.badge, background: '#fee2e2', color: '#991b1b' }}>Cancelado</span>}
                  </div>
                </div>

                {/* Linha 2: objeto */}
                <p style={styles.cardObjeto}>{t.objeto || 'Sem objeto definido'}</p>

                {/* Linha 3: metadados */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {t.componente && <span style={styles.metaInfo}>🧩 {t.componente}</span>}
                  {t.linhas_poa && <span style={styles.metaInfo}>📋 {t.linhas_poa}</span>}
                  {t.prazo_limite && (
                    <span style={{ ...styles.metaInfo, color: atrasado ? '#dc2626' : '#6b7280' }}>
                      📅 Prazo: {new Date(t.prazo_limite).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>

                {/* Barra de etapas */}
                <div style={styles.stepsBar}>
                  {ETAPAS.map((etapa, i) => {
                    const ativo = i === idxEtapa
                    const feito = i < idxEtapa
                    return (
                      <div key={etapa.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1,
                        }}>
                          <div style={{
                            width: '26px', height: '26px', borderRadius: '50%', fontSize: '11px', fontWeight: '700',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: ativo ? '#1a4731' : feito ? '#2d7a4f' : '#e5e7eb',
                            color: (ativo || feito) ? 'white' : '#9ca3af',
                          }}>{feito ? '✓' : etapa.icon}</div>
                          <span style={{ fontSize: '9px', textAlign: 'center', fontWeight: ativo ? '700' : '400', color: ativo ? '#1a4731' : '#9ca3af' }}>
                            {etapa.label}
                          </span>
                        </div>
                        {i < ETAPAS.length - 1 && (
                          <div style={{ width: '20px', height: '2px', background: feito ? '#2d7a4f' : '#e5e7eb', flexShrink: 0, marginBottom: '14px' }} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Rodapé: valores + botões */}
                <div style={styles.cardRodape}>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {t.valor_brl && <span style={styles.valor}><b>R$</b> {fmtMoeda(t.valor_brl)}</span>}
                    {t.valor_usd && <span style={styles.valor}><b>U$</b> {fmtMoeda(t.valor_usd)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => toggleUrgente(t.id, t.urgente)}
                      style={{ ...styles.btnArquivo, background: t.urgente ? '#fee2e2' : '#f3f4f6', color: t.urgente ? '#dc2626' : '#6b7280', border: 'none' }}>
                      {t.urgente ? '🚨 Urgente' : '🔔 Urgente?'}
                    </button>
                    <button onClick={() => abrirEditar(t)} style={styles.btnRevisar}>→ Abrir</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}

function StatCard({ titulo, valor, sub, cor, grande }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `4px solid ${cor}` }}>
      <p style={{ ...styles.statTitulo, color: cor }}>{titulo}</p>
      <p style={{ ...styles.statValor, fontSize: grande ? '18px' : '28px' }}>{valor}</p>
      <p style={styles.statSub}>{sub}</p>
    </div>
  )
}

const styles = {
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' },
  statCard: { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  statTitulo: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  statValor: { fontSize: '28px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0', lineHeight: 1 },
  statSub: { fontSize: '12px', color: '#9ca3af', margin: 0 },
  filtrosBarra: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' },
  buscaInput: { flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit' },
  filtroSelect: { padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit', background: 'white', cursor: 'pointer' },
  contagem: { fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' },
  btnNovo: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' },
  mensagem: { textAlign: 'center', color: '#6b7280', padding: '48px' },
  vazio: { background: '#fff', borderRadius: '12px', padding: '64px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  vazioPrimario: { fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' },
  vazioSecundario: { fontSize: '14px', color: '#9ca3af', margin: 0 },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { background: '#fff', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardTopo: { display: 'flex', alignItems: 'center', gap: '8px' },
  numero: { fontSize: '15px', fontWeight: '700', color: '#111827' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  cardObjeto: { fontSize: '14px', color: '#374151', margin: 0, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  metaInfo: { fontSize: '12px', color: '#6b7280' },
  driveLink: { fontSize: '12px', color: '#1a4731', fontWeight: '600', textDecoration: 'none' },
  stepsBar: { display: 'flex', gap: '4px', alignItems: 'flex-start', margin: '4px 0' },
  cardRodape: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f3f4f6' },
  valor: { fontSize: '13px', color: '#6b7280' },
  btnRevisar: { padding: '7px 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  btnArquivo: { padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' },
  urgenteTag: { fontSize: '10px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '10px' },
}
