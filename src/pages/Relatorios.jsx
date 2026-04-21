import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function fmtMoeda(v) {
  if (!v && v !== 0) return '—'
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

const STATUS_LABEL = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  cancelado: 'Cancelado', aguardando_prestacao: 'Aguard. Prestação',
  prestacao_entregue: 'Prestação Entregue', revisao_interna: 'Revisão Interna',
  ajustes: 'Ajustes', enviado_unesco: 'Enviado UNESCO', retorno_unesco: 'Retorno UNESCO',
}
const ABAS = [
  { id: 'diarias',     label: '✈️ Passagens e Diárias' },
  { id: 'aquisicoes',  label: '🛒 Aquisições' },
  { id: 'tdrs',        label: '📄 TDRs' },
  { id: 'financeiro',  label: '💰 Financeiro Consolidado' },
]

// ── componente principal ──────────────────────────────────────────────────────
export default function Relatorios() {
  const [abaAtiva, setAbaAtiva] = useState('diarias')
  const [diarias,    setDiarias]    = useState([])
  const [aquisicoes, setAquisicoes] = useState([])
  const [tdrs,       setTdrs]       = useState([])
  const [unidades,   setUnidades]   = useState([])
  const [carregando, setCarregando] = useState(true)

  // filtros compartilhados
  const [filtroStatus,  setFiltroStatus]  = useState('todos')
  const [filtroUO,      setFiltroUO]      = useState('todos')
  const [filtroDataDe,  setFiltroDataDe]  = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')
  // filtros específicos
  const [filtroTipo,    setFiltroTipo]    = useState('todos')
  const [filtroModulo,  setFiltroModulo]  = useState('todos')

  useEffect(() => {
    const buscar = async () => {
      setCarregando(true)
      const [{ data: d }, { data: a }, { data: t }, { data: u }] = await Promise.all([
        supabase.from('passagens_diarias').select('*, unidade:unidades(nome,instituicao)').order('created_at', { ascending: false }),
        supabase.from('aquisicoes').select('*, unidade:unidades(nome,instituicao)').order('created_at', { ascending: false }),
        supabase.from('tdrs').select('*, unidade:unidades(nome,instituicao)').order('created_at', { ascending: false }),
        supabase.from('unidades').select('*').order('nome'),
      ])
      setDiarias(d || [])
      setAquisicoes(a || [])
      setTdrs(t || [])
      setUnidades(u || [])
      setCarregando(false)
    }
    buscar()
  }, [])

  // reset filtros ao trocar aba
  const trocarAba = (id) => {
    setAbaAtiva(id)
    setFiltroStatus('todos')
    setFiltroUO('todos')
    setFiltroDataDe('')
    setFiltroDataAte('')
    setFiltroTipo('todos')
    setFiltroModulo('todos')
  }

  // ── dados filtrados por aba ───────────────────────────────────────────────
  const filtrar = (arr) => arr.filter(r => {
    const statusOk  = filtroStatus === 'todos' || r.status === filtroStatus
    const uoOk      = filtroUO     === 'todos' || r.unidade_id === filtroUO
    const dataDeOk  = !filtroDataDe  || new Date(r.created_at) >= new Date(filtroDataDe)
    const dataAteOk = !filtroDataAte || new Date(r.created_at) <= new Date(filtroDataAte + 'T23:59:59')
    return statusOk && uoOk && dataDeOk && dataAteOk
  })

  const dadosDiarias = useMemo(() => filtrar(diarias), [diarias, filtroStatus, filtroUO, filtroDataDe, filtroDataAte])

  const dadosAquisicoes = useMemo(() => filtrar(aquisicoes).filter(a =>
    filtroTipo === 'todos' || a.tipo === filtroTipo
  ), [aquisicoes, filtroStatus, filtroUO, filtroDataDe, filtroDataAte, filtroTipo])

  const dadosTdrs = useMemo(() => filtrar(tdrs).filter(t =>
    filtroTipo === 'todos' || t.tipo === filtroTipo
  ), [tdrs, filtroStatus, filtroUO, filtroDataDe, filtroDataAte, filtroTipo])

  const dadosFinanceiro = useMemo(() => {
    const linhas = []
    if (filtroModulo === 'todos' || filtroModulo === 'Diárias') {
      filtrar(diarias).forEach(r => {
        const d = r.dados || {}
        const nomes = (d.beneficiarios || [{ nome_completo: d.nome_completo }]).map(b => b.nome_completo || '').join(', ')
        linhas.push({ modulo: 'Diárias', demanda: d.numero_demanda || '—', descricao: nomes || '—', uo: r.unidade?.nome || '—', status: STATUS_LABEL[r.status] || r.status, valor_brl: '—', data: fmtData(r.created_at) })
      })
    }
    if (filtroModulo === 'todos' || filtroModulo === 'Aquisições') {
      filtrar(aquisicoes).forEach(r => {
        const total = (r.itens || []).reduce((s, it) => s + Number(it.valor || 0), 0)
        linhas.push({ modulo: 'Aquisições', demanda: r.numero_demanda || '—', descricao: r.tipo === 'adiantamento_recursos' ? 'Adiantamento' : 'Pequenas Compras', uo: r.unidade?.nome || '—', status: STATUS_LABEL[r.status] || r.status, valor_brl: fmtMoeda(total), data: fmtData(r.created_at) })
      })
    }
    if (filtroModulo === 'todos' || filtroModulo === 'TDRs') {
      filtrar(tdrs).forEach(r => {
        linhas.push({ modulo: 'TDRs', demanda: r.numero || '—', descricao: r.objeto ? r.objeto.slice(0, 80) : '—', uo: r.unidade?.nome || '—', status: STATUS_LABEL[r.status] || r.status, valor_brl: fmtMoeda(r.valor_brl), data: fmtData(r.created_at) })
      })
    }
    return linhas
  }, [diarias, aquisicoes, tdrs, filtroModulo, filtroStatus, filtroUO, filtroDataDe, filtroDataAte])

  // ── exportar Excel ────────────────────────────────────────────────────────
  const exportarExcel = () => {
    let linhas = []
    let nomePlanilha = ''
    let nomeArquivo = ''

    if (abaAtiva === 'diarias') {
      nomePlanilha = 'Passagens e Diárias'
      nomeArquivo  = 'relatorio-diarias'
      linhas = dadosDiarias.map(r => {
        const d = r.dados || {}
        const beneficiarios = (d.beneficiarios || [{ nome_completo: d.nome_completo }])
        return {
          'Beneficiário(s)': beneficiarios.map(b => b.nome_completo || '').join(', '),
          'Demanda':         d.numero_demanda || '—',
          'Destino':         d.passagem_destino_1 || d.transporte_destino || '—',
          'UO':              r.unidade?.nome || '—',
          'Instituição':     r.unidade?.instituicao || '—',
          'Status':          STATUS_LABEL[r.status] || r.status,
          'Urgente':         r.urgente ? 'Sim' : 'Não',
          'Data Criação':    fmtData(r.created_at),
          'Data Aprovação':  fmtData(r.data_aprovacao),
          'Prazo Prestação': fmtData(r.prazo_prestacao),
        }
      })
    } else if (abaAtiva === 'aquisicoes') {
      nomePlanilha = 'Aquisições'
      nomeArquivo  = 'relatorio-aquisicoes'
      linhas = dadosAquisicoes.flatMap(a =>
        (a.itens || []).map(it => ({
          'Demanda':     a.numero_demanda || '—',
          'Tipo':        a.tipo === 'adiantamento_recursos' ? 'Adiantamento' : 'Pequenas Compras',
          'UO':          a.unidade?.nome || '—',
          'Produto':     it.nome || '—',
          'Fornecedor':  it.fornecedor || '—',
          'Valor (R$)':  Number(it.valor || 0),
          'Status':      STATUS_LABEL[a.status] || a.status,
          'Urgente':     a.urgente ? 'Sim' : 'Não',
          'Data':        fmtData(a.created_at),
        }))
      )
    } else if (abaAtiva === 'tdrs') {
      nomePlanilha = 'TDRs'
      nomeArquivo  = 'relatorio-tdrs'
      linhas = dadosTdrs.map(t => ({
        'Número':      t.numero || '—',
        'Tipo':        t.tipo || '—',
        'Objeto':      t.objeto || '—',
        'UO':          t.unidade?.nome || '—',
        'Status':      STATUS_LABEL[t.status] || t.status,
        'Valor R$':    Number(t.valor_brl || 0),
        'Valor U$':    Number(t.valor_usd || 0),
        'Prazo':       fmtData(t.prazo_limite),
        'Urgente':     t.urgente ? 'Sim' : 'Não',
        'Data Criação':fmtData(t.created_at),
      }))
    } else {
      nomePlanilha = 'Financeiro Consolidado'
      nomeArquivo  = 'relatorio-financeiro'
      linhas = dadosFinanceiro.map(l => ({
        'Módulo':      l.modulo,
        'Demanda':     l.demanda,
        'Descrição':   l.descricao,
        'UO':          l.uo,
        'Status':      l.status,
        'Valor (R$)':  l.valor_brl,
        'Data':        l.data,
      }))
    }

    if (linhas.length === 0) { alert('Nenhum dado para exportar.'); return }

    const ws = XLSX.utils.json_to_sheet(linhas)
    // largura automática das colunas
    const cols = Object.keys(linhas[0]).map(k => ({ wch: Math.max(k.length, 14) }))
    ws['!cols'] = cols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, nomePlanilha)
    XLSX.writeFile(wb, `${nomeArquivo}-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`)
  }

  // ── imprimir ──────────────────────────────────────────────────────────────
  const imprimir = () => window.print()

  // ── render ────────────────────────────────────────────────────────────────
  const temFiltro = filtroStatus !== 'todos' || filtroUO !== 'todos' || filtroDataDe || filtroDataAte || filtroTipo !== 'todos' || filtroModulo !== 'todos'
  const limparFiltros = () => { setFiltroStatus('todos'); setFiltroUO('todos'); setFiltroDataDe(''); setFiltroDataAte(''); setFiltroTipo('todos'); setFiltroModulo('todos') }

  const totalLinhas = abaAtiva === 'diarias' ? dadosDiarias.length
    : abaAtiva === 'aquisicoes' ? dadosAquisicoes.length
    : abaAtiva === 'tdrs' ? dadosTdrs.length
    : dadosFinanceiro.length

  return (
    <div style={s.page} id="area-impressao">

      {/* ── Abas ── */}
      <div style={s.abas} className="no-print">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => trocarAba(a.id)} style={{
            ...s.aba,
            borderBottom: abaAtiva === a.id ? '3px solid #1a4731' : '3px solid transparent',
            color: abaAtiva === a.id ? '#1a4731' : '#6b7280',
            fontWeight: abaAtiva === a.id ? '700' : '400',
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div style={s.filtrosCard} className="no-print">
        <div style={s.filtrosLinha}>
          {/* Status */}
          <select style={s.sel} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* UO */}
          <select style={s.sel} value={filtroUO} onChange={e => setFiltroUO(e.target.value)}>
            <option value="todos">Todas as UOs</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>

          {/* Tipo — só Aquisições e TDRs */}
          {abaAtiva === 'aquisicoes' && (
            <select style={s.sel} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos os tipos</option>
              <option value="adiantamento_recursos">Adiantamento de Recursos</option>
              <option value="pequenas_compras">Pequenas Compras</option>
            </select>
          )}
          {abaAtiva === 'tdrs' && (
            <select style={s.sel} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="todos">PF + PJ</option>
              <option value="PF">Apenas PF</option>
              <option value="PJ">Apenas PJ</option>
            </select>
          )}
          {abaAtiva === 'financeiro' && (
            <select style={s.sel} value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}>
              <option value="todos">Todos os módulos</option>
              <option value="Diárias">Diárias</option>
              <option value="Aquisições">Aquisições</option>
              <option value="TDRs">TDRs</option>
            </select>
          )}

          {/* Período */}
          <input style={s.inp} type="date" value={filtroDataDe}  onChange={e => setFiltroDataDe(e.target.value)}  title="Data inicial" />
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>até</span>
          <input style={s.inp} type="date" value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)} title="Data final" />

          {temFiltro && <button onClick={limparFiltros} style={s.btnLimpar}>✕ Limpar</button>}

          <span style={s.contagem}>{totalLinhas} registro{totalLinhas !== 1 ? 's' : ''}</span>

          {/* Botões de exportação */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={exportarExcel} style={s.btnExcel}>📥 Exportar Excel</button>
            <button onClick={imprimir}      style={s.btnImprimir}>🖨️ Imprimir</button>
          </div>
        </div>
      </div>

      {/* ── Cabeçalho de impressão (só aparece ao imprimir) ── */}
      <div style={s.cabecalhoImpressao} className="print-only">
        <h2 style={{ margin: 0 }}>Sistema de Gestão FGV · SEMA · ICMBIO</h2>
        <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
          {ABAS.find(a => a.id === abaAtiva)?.label.replace(/[^\w\s]/g, '').trim()} — gerado em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      {/* ── Tabelas ── */}
      {carregando ? (
        <p style={s.msg}>Carregando dados...</p>
      ) : totalLinhas === 0 ? (
        <div style={s.vazio}>
          <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' }}>Nenhum registro encontrado</p>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Tente ajustar os filtros</p>
        </div>
      ) : (
        <div style={s.tabelaWrap}>

          {/* ── DIÁRIAS ── */}
          {abaAtiva === 'diarias' && (
            <table style={s.tabela}>
              <thead><tr style={s.thead}>
                <Th>Beneficiário(s)</Th><Th>Demanda</Th><Th>Destino</Th>
                <Th>UO</Th><Th>Status</Th><Th>Urgente</Th>
                <Th>Criação</Th><Th>Aprovação</Th><Th>Prazo Prestação</Th>
              </tr></thead>
              <tbody>
                {dadosDiarias.map((r, i) => {
                  const d = r.dados || {}
                  const bens = (d.beneficiarios || [{ nome_completo: d.nome_completo }]).map(b => b.nome_completo || '').join(', ')
                  return (
                    <tr key={r.id} style={{ background: r.urgente ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <Td bold>{bens || '—'}</Td>
                      <Td>{d.numero_demanda || '—'}</Td>
                      <Td>{d.passagem_destino_1 || d.transporte_destino || '—'}</Td>
                      <Td>{r.unidade?.nome || '—'}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td>{r.urgente ? <span style={s.urgenteTag}>🚨</span> : '—'}</Td>
                      <Td>{fmtData(r.created_at)}</Td>
                      <Td>{fmtData(r.data_aprovacao)}</Td>
                      <Td>{fmtData(r.prazo_prestacao)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* ── AQUISIÇÕES ── */}
          {abaAtiva === 'aquisicoes' && (
            <table style={s.tabela}>
              <thead><tr style={s.thead}>
                <Th>Demanda</Th><Th>Tipo</Th><Th>UO</Th>
                <Th>Produto</Th><Th>Fornecedor</Th><Th right>Valor (R$)</Th>
                <Th>Status</Th><Th>Urgente</Th><Th>Data</Th>
              </tr></thead>
              <tbody>
                {dadosAquisicoes.flatMap((a, ai) =>
                  (a.itens || []).map((it, ii) => (
                    <tr key={`${a.id}-${ii}`} style={{ background: a.urgente ? '#fff5f5' : ai % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <Td bold>{a.numero_demanda || '—'}</Td>
                      <Td>{a.tipo === 'adiantamento_recursos' ? 'Adiantamento' : 'Peq. Compras'}</Td>
                      <Td>{a.unidade?.nome || '—'}</Td>
                      <Td>{it.nome || '—'}</Td>
                      <Td>{it.fornecedor || '—'}</Td>
                      <Td right mono>R$ {fmtMoeda(it.valor)}</Td>
                      <Td><StatusBadge status={a.status} /></Td>
                      <Td>{a.urgente ? <span style={s.urgenteTag}>🚨</span> : '—'}</Td>
                      <Td>{fmtData(a.created_at)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f0fdf4', fontWeight: '700' }}>
                  <td colSpan={5} style={{ ...s.tdBase, textAlign: 'right', color: '#374151' }}>Total:</td>
                  <td style={{ ...s.tdBase, textAlign: 'right', color: '#1a4731' }}>
                    R$ {fmtMoeda(dadosAquisicoes.reduce((s, a) => s + (a.itens || []).reduce((si, it) => si + Number(it.valor || 0), 0), 0))}
                  </td>
                  <td colSpan={3} style={s.tdBase} />
                </tr>
              </tfoot>
            </table>
          )}

          {/* ── TDRs ── */}
          {abaAtiva === 'tdrs' && (
            <table style={s.tabela}>
              <thead><tr style={s.thead}>
                <Th>Número</Th><Th>Tipo</Th><Th>Objeto</Th><Th>UO</Th>
                <Th>Status</Th><Th right>Valor R$</Th><Th right>Valor U$</Th>
                <Th>Prazo</Th><Th>Urgente</Th><Th>Criação</Th>
              </tr></thead>
              <tbody>
                {dadosTdrs.map((t, i) => (
                  <tr key={t.id} style={{ background: t.urgente ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <Td bold>{t.numero || 'S/N'}</Td>
                    <Td>{t.tipo || '—'}</Td>
                    <Td max={200}>{t.objeto || '—'}</Td>
                    <Td>{t.unidade?.nome || '—'}</Td>
                    <Td><StatusBadge status={t.status} /></Td>
                    <Td right mono>R$ {fmtMoeda(t.valor_brl)}</Td>
                    <Td right mono>U$ {fmtMoeda(t.valor_usd)}</Td>
                    <Td>{fmtData(t.prazo_limite)}</Td>
                    <Td>{t.urgente ? <span style={s.urgenteTag}>🚨</span> : '—'}</Td>
                    <Td>{fmtData(t.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f0fdf4', fontWeight: '700' }}>
                  <td colSpan={5} style={{ ...s.tdBase, textAlign: 'right', color: '#374151' }}>Total:</td>
                  <td style={{ ...s.tdBase, textAlign: 'right', color: '#1a4731' }}>R$ {fmtMoeda(dadosTdrs.reduce((sum, t) => sum + Number(t.valor_brl || 0), 0))}</td>
                  <td style={{ ...s.tdBase, textAlign: 'right', color: '#1d4ed8' }}>U$ {fmtMoeda(dadosTdrs.reduce((sum, t) => sum + Number(t.valor_usd || 0), 0))}</td>
                  <td colSpan={3} style={s.tdBase} />
                </tr>
              </tfoot>
            </table>
          )}

          {/* ── FINANCEIRO ── */}
          {abaAtiva === 'financeiro' && (
            <table style={s.tabela}>
              <thead><tr style={s.thead}>
                <Th>Módulo</Th><Th>Demanda</Th><Th>Descrição</Th>
                <Th>UO</Th><Th>Status</Th><Th right>Valor (R$)</Th><Th>Data</Th>
              </tr></thead>
              <tbody>
                {dadosFinanceiro.map((l, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <Td><ModuloBadge modulo={l.modulo} /></Td>
                    <Td bold>{l.demanda}</Td>
                    <Td max={220}>{l.descricao}</Td>
                    <Td>{l.uo}</Td>
                    <Td><StatusBadge status={Object.entries(STATUS_LABEL).find(([,v]) => v === l.status)?.[0] || ''} label={l.status} /></Td>
                    <Td right mono>{l.valor_brl}</Td>
                    <Td>{l.data}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CSS de impressão */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #area-impressao, #area-impressao * { visibility: visible; }
          #area-impressao { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          table { font-size: 11px; }
          th, td { padding: 6px 8px !important; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  )
}

// ── sub-componentes ───────────────────────────────────────────────────────────
function Th({ children, right }) {
  return (
    <th style={{ padding: '10px 14px', textAlign: right ? 'right' : 'left', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap', background: '#f9fafb' }}>
      {children}
    </th>
  )
}
function Td({ children, bold, right, mono, max }) {
  return (
    <td style={{
      padding: '10px 14px', color: bold ? '#111827' : '#374151',
      fontWeight: bold ? '600' : '400', textAlign: right ? 'right' : 'left',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal', fontSize: '13px',
      maxWidth: max ? `${max}px` : undefined,
      overflow: max ? 'hidden' : undefined,
      textOverflow: max ? 'ellipsis' : undefined,
      whiteSpace: max ? 'nowrap' : undefined,
    }}>{children}</td>
  )
}

const STATUS_COR_MAP = {
  rascunho: ['#f3f4f6','#6b7280'], enviado: ['#dbeafe','#1e40af'],
  aprovado: ['#dcfce7','#166534'], cancelado: ['#fee2e2','#991b1b'],
  aguardando_prestacao: ['#fef3c7','#92400e'], prestacao_entregue: ['#ede9fe','#5b21b6'],
  revisao_interna: ['#dbeafe','#1e40af'], ajustes: ['#fef3c7','#92400e'],
  enviado_unesco: ['#ede9fe','#5b21b6'], retorno_unesco: ['#ffedd5','#9a3412'],
}
function StatusBadge({ status, label }) {
  const [bg, cor] = STATUS_COR_MAP[status] || ['#f3f4f6','#6b7280']
  return <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: bg, color: cor, whiteSpace: 'nowrap' }}>{label || STATUS_LABEL[status] || status}</span>
}

const MODULO_COR_MAP = { 'Diárias': '#2d7a4f', 'Aquisições': '#b45309', 'TDRs': '#1d4ed8' }
function ModuloBadge({ modulo }) {
  const cor = MODULO_COR_MAP[modulo] || '#6b7280'
  return <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: cor + '18', color: cor }}>{modulo}</span>
}

// ── estilos ───────────────────────────────────────────────────────────────────
const s = {
  page:       { display: 'flex', flexDirection: 'column', gap: '16px' },
  abas:       { display: 'flex', borderBottom: '2px solid #e5e7eb', gap: '4px', background: '#fff', borderRadius: '12px 12px 0 0', padding: '0 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  aba:        { padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s', whiteSpace: 'nowrap' },
  filtrosCard:{ background: '#fff', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filtrosLinha:{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  sel:        { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'inherit', cursor: 'pointer' },
  inp:        { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '130px' },
  btnLimpar:  { padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#6b7280' },
  contagem:   { fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' },
  btnExcel:   { padding: '9px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #166534, #22c55e)', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' },
  btnImprimir:{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
  tabelaWrap: { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', overflowX: 'auto' },
  tabela:     { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead:      { borderBottom: '2px solid #e5e7eb' },
  tdBase:     { padding: '10px 14px', fontSize: '13px' },
  msg:        { textAlign: 'center', padding: '60px', color: '#6b7280' },
  vazio:      { background: '#fff', borderRadius: '12px', padding: '64px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  urgenteTag: { fontSize: '14px' },
  cabecalhoImpressao: { marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #e5e7eb' },
}
