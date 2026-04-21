import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ModalAquisicao from '../components/ModalAquisicao'
import { downloadArquivo, downloadZip } from '../lib/downloads'

const STATUS_COR = {
  rascunho:  { bg: '#f3f4f6', cor: '#6b7280', label: 'Rascunho' },
  enviado:   { bg: '#dbeafe', cor: '#1e40af', label: 'Enviado' },
  aprovado:  { bg: '#dcfce7', cor: '#166534', label: 'Aprovado' },
  cancelado: { bg: '#fee2e2', cor: '#991b1b', label: 'Cancelado' },
}

const TIPO_COR = {
  adiantamento_recursos: { bg: '#ede9fe', cor: '#5b21b6', label: 'Adiantamento de Recursos' },
  pequenas_compras:      { bg: '#fef3c7', cor: '#92400e', label: 'Pequenas Compras' },
}

function fmtMoeda(v) {
  const n = Number(v || 0)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function Aquisicoes({ perfilUsuario }) {
  const [aquisicoes, setAquisicoes] = useState([])
  const [unidades, setUnidades]     = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal]           = useState(false)
  const [selecionada, setSelecionada] = useState(null)

  // Filtros
  const [busca, setBusca]               = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo]     = useState('todos')
  const [filtroUO, setFiltroUO]         = useState('todos')
  const [filtroDemanda, setFiltroDemanda] = useState('')
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [filtroDataDe, setFiltroDataDe] = useState('')
  const [filtroDataAte, setFiltroDataAte] = useState('')

  const isAdmin = perfilUsuario?.perfil === 'administrador'

  const carregar = async () => {
    setCarregando(true)
    const [{ data: aq }, { data: un }] = await Promise.all([
      supabase.from('aquisicoes').select('*, unidade:unidades(nome, instituicao)').order('created_at', { ascending: false }),
      supabase.from('unidades').select('*').order('nome'),
    ])
    setAquisicoes(aq || [])
    setUnidades(un || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const abrirNova   = () => { setSelecionada(null); setModal(true) }
  const abrirEditar = (a) => { setSelecionada(a); setModal(true) }
  const fechar      = () => { setModal(false); setSelecionada(null) }
  const aoSalvar    = () => { fechar(); carregar() }

  const aprovar   = async (id) => {
    await supabase.from('aquisicoes').update({ status: 'aprovado', updated_at: new Date().toISOString() }).eq('id', id)
    carregar()
  }
  const toggleUrgente = async (id, atual) => {
    await supabase.from('aquisicoes').update({ urgente: !atual, updated_at: new Date().toISOString() }).eq('id', id)
    carregar()
  }

  const cancelar  = async (id) => {
    if (!confirm('Cancelar esta aquisição?')) return
    await supabase.from('aquisicoes').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', id)
    carregar()
  }

  // Filtrar
  const filtradas = aquisicoes.filter(a => {
    const itens = a.itens || []
    const nomes = itens.map(it => (it.nome || '').toLowerCase()).join(' ')
    const forn  = itens.map(it => (it.fornecedor || '').toLowerCase()).join(' ')

    const buscaOk = !busca || nomes.includes(busca.toLowerCase()) || (a.numero_demanda || '').toLowerCase().includes(busca.toLowerCase())
    const statusOk = filtroStatus === 'todos' || a.status === filtroStatus
    const tipoOk   = filtroTipo   === 'todos' || a.tipo === filtroTipo
    const uoOk     = filtroUO     === 'todos' || a.unidade_id === filtroUO
    const demandaOk = !filtroDemanda || (a.numero_demanda || '').toLowerCase().includes(filtroDemanda.toLowerCase())
    const fornOk   = !filtroFornecedor || forn.includes(filtroFornecedor.toLowerCase())
    const dataDeOk = !filtroDataDe || new Date(a.created_at) >= new Date(filtroDataDe)
    const dataAteOk = !filtroDataAte || new Date(a.created_at) <= new Date(filtroDataAte + 'T23:59:59')

    return buscaOk && statusOk && tipoOk && uoOk && demandaOk && fornOk && dataDeOk && dataAteOk
  })

  // Stats
  const total         = aquisicoes.length
  const adiantamentos = aquisicoes.filter(a => a.tipo === 'adiantamento_recursos').length
  const pequenas      = aquisicoes.filter(a => a.tipo === 'pequenas_compras').length
  const aprovadas     = aquisicoes.filter(a => a.status === 'aprovado').length
  const valorTotal    = aquisicoes
    .filter(a => a.status !== 'cancelado')
    .reduce((s, a) => s + (a.itens || []).reduce((si, it) => si + Number(it.valor || 0), 0), 0)

  const limparFiltros = () => {
    setBusca(''); setFiltroStatus('todos'); setFiltroTipo('todos')
    setFiltroUO('todos'); setFiltroDemanda(''); setFiltroFornecedor('')
    setFiltroDataDe(''); setFiltroDataAte('')
  }
  const temFiltro = busca || filtroStatus !== 'todos' || filtroTipo !== 'todos' ||
    filtroUO !== 'todos' || filtroDemanda || filtroFornecedor || filtroDataDe || filtroDataAte

  return (
    <div>
      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard titulo="TOTAL" valor={total} sub={`${aprovadas} aprovadas`} cor="#1a4731" />
        <StatCard titulo="ADIANTAMENTO" valor={adiantamentos} sub="de recursos" cor="#5b21b6" />
        <StatCard titulo="PEQUENAS COMPRAS" valor={pequenas} sub="registradas" cor="#92400e" />
        <StatCard titulo="APROVADAS" valor={aprovadas} sub="concluídas" cor="#166534" />
        <StatCard titulo="VALOR TOTAL" valor={`R$ ${fmtMoeda(valorTotal)}`} sub="em aquisições ativas" cor="#b45309" grande />
      </div>

      {/* Filtros */}
      <div style={styles.filtrosCard}>
        <div style={styles.filtrosLinha1}>
          <input style={styles.buscaInput} value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍  Buscar por produto ou demanda..." />
          <button onClick={abrirNova} style={styles.btnNovo}>+ Nova Aquisição</button>
        </div>

        <div style={styles.filtrosLinha2}>
          <select style={styles.filtroSelect} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_COR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <select style={styles.filtroSelect} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {Object.entries(TIPO_COR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <select style={styles.filtroSelect} value={filtroUO} onChange={e => setFiltroUO(e.target.value)}>
            <option value="todos">Todas as UOs</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome} — {u.instituicao}</option>)}
          </select>

          <input style={styles.filtroInput} value={filtroDemanda}
            onChange={e => setFiltroDemanda(e.target.value)} placeholder="Filtrar por demanda..." />

          <input style={styles.filtroInput} value={filtroFornecedor}
            onChange={e => setFiltroFornecedor(e.target.value)} placeholder="Filtrar por fornecedor..." />

          <input style={styles.filtroInput} type="date" value={filtroDataDe}
            onChange={e => setFiltroDataDe(e.target.value)} title="Data inicial" />
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>até</span>
          <input style={styles.filtroInput} type="date" value={filtroDataAte}
            onChange={e => setFiltroDataAte(e.target.value)} title="Data final" />

          {temFiltro && (
            <button onClick={limparFiltros} style={styles.btnLimpar}>✕ Limpar</button>
          )}

          <span style={styles.contagem}>{filtradas.length} de {total}</span>
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <p style={styles.mensagem}>Carregando...</p>
      ) : filtradas.length === 0 ? (
        <div style={styles.vazio}>
          <p style={styles.vazioPrimario}>{temFiltro ? 'Nenhum resultado para os filtros aplicados' : 'Nenhuma aquisição registrada'}</p>
          <p style={styles.vazioSecundario}>{temFiltro ? 'Tente limpar os filtros' : 'Clique em "+ Nova Aquisição" para começar'}</p>
        </div>
      ) : (
        <div style={styles.lista}>
          {filtradas.map((a, ri) => {
            const itens     = a.itens || []
            const corStatus = STATUS_COR[a.status] || STATUS_COR.rascunho
            const corTipo   = TIPO_COR[a.tipo]     || TIPO_COR.pequenas_compras
            const totalPacote = itens.reduce((s, it) => s + Number(it.valor || 0), 0)
            const fornecedores = [...new Set(itens.map(it => it.fornecedor).filter(Boolean))]

            return (
              <div key={a.id} style={{ ...styles.card, background: a.urgente ? '#fff5f5' : ri % 2 === 0 ? '#fff' : '#fafafa', borderLeft: a.urgente ? '4px solid #dc2626' : '4px solid transparent' }}>
                {/* Cabeçalho do card */}
                <div style={styles.cardTopo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                    {a.urgente && <span style={styles.urgenteTag}>🚨 URGENTE</span>}
                    <span style={styles.demanda}>{a.numero_demanda || 'Sem demanda'}</span>
                    <span style={{ ...styles.badge, background: corTipo.bg, color: corTipo.cor }}>{corTipo.label}</span>
                    <span style={{ ...styles.badge, background: corStatus.bg, color: corStatus.cor }}>{corStatus.label}</span>
                    {a.unidade && <span style={styles.uo}>{a.unidade.nome}</span>}
                  </div>
                  <span style={styles.data}>{fmtData(a.created_at)}</span>
                </div>

                {/* Tabela de itens */}
                <table style={styles.tabelaItens}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={styles.th}>Item / Produto</th>
                      <th style={styles.th}>Fornecedor</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Valor</th>
                      <th style={styles.th}>Nota Fiscal</th>
                      <th style={styles.th}>Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it, ii) => (
                      <tr key={ii} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={styles.td}>{it.nome || '—'}</td>
                        <td style={styles.td}>{it.fornecedor || '—'}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                          R$ {fmtMoeda(it.valor)}
                        </td>
                        <td style={styles.td}>
                          {it.nota_fiscal_url ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <a href={it.nota_fiscal_url} target="_blank" rel="noreferrer" style={styles.linkNota}>📄 Ver</a>
                              <button onClick={() => downloadArquivo(it.nota_fiscal_url, `nota-${it.nome || ii}.pdf`)} style={styles.btnDl}>⬇️</button>
                            </div>
                          ) : <span style={{ color: '#d1d5db', fontSize: '12px' }}>Sem nota</span>}
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {(it.fotos_urls || []).slice(0, 3).map((url, fi) => (
                              <a key={fi} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" style={styles.miniFoto} />
                              </a>
                            ))}
                            {(it.fotos_urls || []).length === 0 && (
                              <span style={{ color: '#d1d5db', fontSize: '12px' }}>Sem fotos</span>
                            )}
                            {(it.fotos_urls || []).length > 3 && (
                              <span style={styles.maisfotos}>+{it.fotos_urls.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Rodapé do card */}
                <div style={styles.cardRodape}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={styles.totalCard}>Total: <strong>R$ {fmtMoeda(totalPacote)}</strong></span>
                    {fornecedores.length > 0 && (
                      <span style={styles.fornecedorTag}>🏪 {fornecedores.join(', ')}</span>
                    )}
                    {a.observacoes && (
                      <span style={styles.obs} title={a.observacoes}>💬 {a.observacoes.slice(0, 60)}{a.observacoes.length > 60 ? '...' : ''}</span>
                    )}
                    {/* Botão ZIP — só aparece se houver algum anexo */}
                    {itens.some(it => it.nota_fiscal_url || (it.fotos_urls || []).length > 0) && (
                      <button onClick={() => {
                        const arquivos = []
                        itens.forEach((it, idx) => {
                          if (it.nota_fiscal_url) arquivos.push({ url: it.nota_fiscal_url, nome: `item${idx+1}-nota.pdf` })
                          ;(it.fotos_urls || []).forEach((url, fi) => arquivos.push({ url, nome: `item${idx+1}-foto${fi+1}.jpg` }))
                        })
                        downloadZip(arquivos, `aquisicao-${a.numero_demanda || a.id}`)
                      }} style={styles.btnZip}>
                        📦 Baixar tudo (.zip)
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => abrirEditar(a)} style={styles.btnEditar}>✏️ Editar</button>
                    <button onClick={() => toggleUrgente(a.id, a.urgente)}
                      style={{ ...styles.btnEditar, background: a.urgente ? '#fee2e2' : '#f3f4f6', color: a.urgente ? '#dc2626' : '#6b7280', border: 'none' }}>
                      {a.urgente ? '🚨 Urgente' : '🔔 Urgente?'}
                    </button>
                    {isAdmin && a.status === 'enviado' && (
                      <button onClick={() => aprovar(a.id)} style={styles.btnAprovar}>✓ Aprovar</button>
                    )}
                    {['rascunho','enviado'].includes(a.status) && (
                      <button onClick={() => cancelar(a.id)} style={styles.btnCancelar}>🚫 Cancelar</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <ModalAquisicao
          aquisicao={selecionada}
          perfilUsuario={perfilUsuario}
          unidades={unidades}
          onFechar={fechar}
          onSalvar={aoSalvar}
        />
      )}
    </div>
  )
}

function StatCard({ titulo, valor, sub, cor, grande }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `4px solid ${cor}` }}>
      <p style={{ fontSize: '11px', fontWeight: '700', color: cor, letterSpacing: '0.5px', margin: '0 0 8px 0' }}>{titulo}</p>
      <p style={{ fontSize: grande ? '18px' : '28px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0', lineHeight: 1 }}>{valor}</p>
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{sub}</p>
    </div>
  )
}

const styles = {
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' },
  filtrosCard: { background: '#fff', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' },
  filtrosLinha1: { display: 'flex', gap: '10px', alignItems: 'center' },
  filtrosLinha2: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  buscaInput: { flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '14px', outline: 'none', fontFamily: 'inherit' },
  filtroSelect: { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer', fontFamily: 'inherit' },
  filtroInput: { padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '13px', outline: 'none', fontFamily: 'inherit', width: '140px' },
  btnLimpar: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#6b7280' },
  contagem: { fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 'auto' },
  btnNovo: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' },
  mensagem: { textAlign: 'center', color: '#6b7280', padding: '48px' },
  vazio: { background: '#fff', borderRadius: '12px', padding: '64px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  vazioPrimario: { fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' },
  vazioSecundario: { fontSize: '14px', color: '#9ca3af', margin: 0 },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap', gap: '8px' },
  demanda: { fontSize: '14px', fontWeight: '700', color: '#111827' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
  uo: { fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '3px 8px', borderRadius: '12px' },
  data: { fontSize: '12px', color: '#9ca3af' },
  tabelaItens: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '8px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px' },
  td: { padding: '10px 18px', color: '#374151', verticalAlign: 'middle' },
  linkNota: { color: '#1a4731', fontWeight: '600', textDecoration: 'none', fontSize: '12px' },
  miniFoto: { width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' },
  maisfotos: { width: '32px', height: '32px', background: '#f3f4f6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#6b7280', fontWeight: '600' },
  cardRodape: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid #f3f4f6', background: '#fafafa', flexWrap: 'wrap', gap: '8px' },
  totalCard: { fontSize: '14px', color: '#374151' },
  fornecedorTag: { fontSize: '12px', color: '#6b7280' },
  obs: { fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' },
  btnEditar: { padding: '6px 12px', borderRadius: '6px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px' },
  urgenteTag: { fontSize: '10px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '10px' },
  btnAprovar: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  btnCancelar: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', fontSize: '12px' },
  btnDl:  { padding: '2px 7px', borderRadius: '5px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '11px' },
  btnZip: { padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
}
