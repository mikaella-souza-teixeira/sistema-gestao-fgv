import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import FormPassagens from '../components/FormPassagens'
import { downloadArquivo, downloadZip } from '../lib/downloads'

const STATUS_COR = {
  rascunho:            { bg: '#f3f4f6', cor: '#6b7280' },
  enviado:             { bg: '#dbeafe', cor: '#1e40af' },
  aprovado:            { bg: '#dcfce7', cor: '#166534' },
  cancelado:           { bg: '#fee2e2', cor: '#991b1b' },
  aguardando_prestacao:{ bg: '#fef3c7', cor: '#92400e' },
  prestacao_entregue:  { bg: '#ede9fe', cor: '#5b21b6' },
}

const STATUS_LABEL = {
  rascunho:            'Rascunho',
  enviado:             'Enviado',
  aprovado:            'Aprovado',
  cancelado:           'Cancelado',
  aguardando_prestacao:'Aguard. Prestação',
  prestacao_entregue:  'Prestação Entregue',
}

function diasRestantes(prazo) {
  if (!prazo) return null
  const diff = new Date(prazo) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function PassagensDiarias({ perfilUsuario }) {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [selecionada, setSelecionada] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('lista') // 'lista' | 'prestacao'
  const [processando, setProcessando] = useState(null)
  const [uploadando, setUploadando] = useState(null)
  const declaracaoRef = useRef({})
  const relatorioRef = useRef({})

  const isAdmin = perfilUsuario?.perfil === 'administrador'

  const carregar = async () => {
    setCarregando(true)
    const { data } = await supabase
      .from('passagens_diarias')
      .select('*, unidade:unidades(nome, instituicao)')
      .order('created_at', { ascending: false })
    setSolicitacoes(data || [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const abrirNova = () => { setSelecionada(null); setFormAberto(true) }
  const abrirEditar = (s) => { setSelecionada(s); setFormAberto(true) }
  const fechar = () => { setFormAberto(false); setSelecionada(null) }
  const aoSalvar = () => { fechar(); carregar() }

  const aprovar = async (id) => {
    setProcessando(id)
    const agora = new Date().toISOString()
    const prazo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('passagens_diarias').update({
      status: 'aguardando_prestacao',
      data_aprovacao: agora,
      prazo_prestacao: prazo,
      updated_at: agora,
    }).eq('id', id)
    // Marcar notificação como lida
    await supabase.from('notificacoes').update({ lida: true })
      .eq('referencia_id', id)
    await carregar()
    setProcessando(null)
  }

  const recusar = async (id) => {
    setProcessando(id)
    await supabase.from('passagens_diarias').update({
      status: 'cancelado',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await supabase.from('notificacoes').update({ lida: true })
      .eq('referencia_id', id)
    await carregar()
    setProcessando(null)
  }

  const cancelarSolicitacao = async (id) => {
    if (!confirm('Cancelar esta solicitação?')) return
    setProcessando(id)
    await supabase.from('passagens_diarias').update({
      status: 'cancelado',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await carregar()
    setProcessando(null)
  }

  const toggleUrgente = async (id, atual) => {
    await supabase.from('passagens_diarias').update({ urgente: !atual, updated_at: new Date().toISOString() }).eq('id', id)
    carregar()
  }

  const cancelarAprovacao = async (id) => {
    if (!confirm('Cancelar a aprovação e devolver para "Enviado"?')) return
    setProcessando(id)
    await supabase.from('passagens_diarias').update({
      status: 'enviado',
      data_aprovacao: null,
      prazo_prestacao: null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await carregar()
    setProcessando(null)
  }

  const uploadAnexo = async (id, tipo, arquivo) => {
    setUploadando(`${id}-${tipo}`)
    try {
      const ext = arquivo.name.split('.').pop()
      const path = `prestacao/${id}/${tipo}.${ext}`
      const { error } = await supabase.storage.from('anexos').upload(path, arquivo, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('anexos').getPublicUrl(path)
      const campo = tipo === 'declaracao' ? 'anexo_declaracao_url' : 'anexo_relatorio_url'
      await supabase.from('passagens_diarias').update({
        [campo]: urlData.publicUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      // Verificar se ambos os anexos foram entregues
      const { data: sol } = await supabase.from('passagens_diarias').select('anexo_declaracao_url, anexo_relatorio_url').eq('id', id).single()
      const outroAnexo = tipo === 'declaracao' ? sol?.anexo_relatorio_url : sol?.anexo_declaracao_url
      if (urlData.publicUrl && outroAnexo) {
        await supabase.from('passagens_diarias').update({
          status: 'prestacao_entregue',
          updated_at: new Date().toISOString(),
        }).eq('id', id)
      }
      await carregar()
    } catch (e) {
      alert(`Erro ao fazer upload: ${e.message}`)
    }
    setUploadando(null)
  }

  if (formAberto) {
    return (
      <FormPassagens
        solicitacao={selecionada}
        perfilUsuario={perfilUsuario}
        onVoltar={fechar}
        onSalvar={aoSalvar}
      />
    )
  }

  const lista = solicitacoes.filter(s =>
    !['aguardando_prestacao', 'prestacao_entregue'].includes(s.status) || abaAtiva === 'lista'
  )
  const emPrestacao = solicitacoes.filter(s =>
    ['aguardando_prestacao', 'prestacao_entregue'].includes(s.status)
  )
  const pendentesAprovacao = solicitacoes.filter(s => s.status === 'enviado').length

  return (
    <div>
      <div style={styles.topBar}>
        <div>
          <h2 style={styles.titulo}>Passagens e Diárias</h2>
          <p style={styles.subtitulo}>{solicitacoes.length} solicitações registradas</p>
        </div>
        <button onClick={abrirNova} style={styles.botaoNovo}>
          + Nova Solicitação
        </button>
      </div>

      {/* Abas principais */}
      <div style={styles.abas}>
        <button onClick={() => setAbaAtiva('lista')} style={{
          ...styles.aba, borderBottom: abaAtiva === 'lista' ? '3px solid #1a4731' : '3px solid transparent',
          color: abaAtiva === 'lista' ? '#1a4731' : '#6b7280', fontWeight: abaAtiva === 'lista' ? '700' : '400',
        }}>
          Solicitações
          {isAdmin && pendentesAprovacao > 0 && (
            <span style={styles.badge}>{pendentesAprovacao}</span>
          )}
        </button>
        <button onClick={() => setAbaAtiva('prestacao')} style={{
          ...styles.aba, borderBottom: abaAtiva === 'prestacao' ? '3px solid #92400e' : '3px solid transparent',
          color: abaAtiva === 'prestacao' ? '#92400e' : '#6b7280', fontWeight: abaAtiva === 'prestacao' ? '700' : '400',
        }}>
          Prestação de Contas
          {emPrestacao.filter(s => s.status === 'aguardando_prestacao').length > 0 && (
            <span style={{ ...styles.badge, background: '#92400e' }}>
              {emPrestacao.filter(s => s.status === 'aguardando_prestacao').length}
            </span>
          )}
        </button>
      </div>

      {/* ── ABA: Solicitações ─────────────────────────────────────────────── */}
      {abaAtiva === 'lista' && (
        <div style={styles.tabela}>
          {carregando ? (
            <p style={styles.mensagem}>Carregando...</p>
          ) : solicitacoes.length === 0 ? (
            <div style={styles.vazio}>
              <p style={styles.vazioPrimario}>Nenhuma solicitação ainda</p>
              <p style={styles.vazioSecundario}>Clique em "Nova Solicitação" para começar</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Beneficiário(s)</th>
                  <th style={styles.th}>Demanda</th>
                  <th style={styles.th}>Destino</th>
                  <th style={styles.th}>Data</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.map((s, i) => {
                  const d = s.dados || {}
                  const cor = STATUS_COR[s.status] || STATUS_COR.rascunho
                  const beneficiarios = d.beneficiarios || [{ nome_completo: d.nome_completo }]
                  const nomes = beneficiarios.map(b => b.nome_completo || '—').slice(0, 2)
                  const extras = beneficiarios.length > 2 ? ` +${beneficiarios.length - 2}` : ''
                  return (
                    <tr key={s.id} style={{ background: s.urgente ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb', borderLeft: s.urgente ? '4px solid #dc2626' : '4px solid transparent' }}>
                      <td style={styles.td}>
                        {s.urgente && <span style={styles.urgenteTag}>🚨 URGENTE</span>}
                        <p style={styles.nomeTexto}>{nomes.join(', ')}{extras}</p>
                        <p style={styles.emailTexto}>{s.numero_rpad || 'Sem número'}</p>
                      </td>
                      <td style={styles.td}>
                        <p style={{ fontSize: '13px', color: '#374151' }}>{d.numero_demanda || '—'}</p>
                      </td>
                      <td style={styles.td}>
                        <p style={{ fontSize: '13px', color: '#374151' }}>
                          {d.passagem_destino_1 || d.transporte_destino || '—'}
                        </p>
                      </td>
                      <td style={styles.td}>
                        <p style={{ fontSize: '13px', color: '#374151' }}>
                          {new Date(s.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, background: cor.bg, color: cor.cor }}>
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button onClick={() => abrirEditar(s)} style={styles.btnAcao} title="Editar">✏️</button>
                          <button onClick={() => toggleUrgente(s.id, s.urgente)}
                            style={{ ...styles.btnAcaoTexto, background: s.urgente ? '#fee2e2' : '#f3f4f6', color: s.urgente ? '#dc2626' : '#6b7280' }}
                            title={s.urgente ? 'Remover urgência' : 'Marcar como urgente'}>
                            {s.urgente ? '🚨 Urgente' : '🔔 Urgente?'}
                          </button>
                          {/* Aprovar / Recusar — admin, status enviado */}
                          {isAdmin && s.status === 'enviado' && (
                            <>
                              <button onClick={() => aprovar(s.id)} disabled={processando === s.id}
                                style={{ ...styles.btnAcaoTexto, background: '#dcfce7', color: '#166534' }}>
                                {processando === s.id ? '...' : '✓ Aprovar'}
                              </button>
                              <button onClick={() => recusar(s.id)} disabled={processando === s.id}
                                style={{ ...styles.btnAcaoTexto, background: '#fee2e2', color: '#991b1b' }}>
                                ✕ Recusar
                              </button>
                            </>
                          )}
                          {/* Cancelar solicitação — status enviado */}
                          {s.status === 'enviado' && (
                            <button onClick={() => cancelarSolicitacao(s.id)} disabled={processando === s.id}
                              style={{ ...styles.btnAcaoTexto, background: '#f3f4f6', color: '#6b7280' }}>
                              🚫 Cancelar
                            </button>
                          )}
                          {/* Cancelar aprovação — admin, status aguardando_prestacao */}
                          {isAdmin && s.status === 'aguardando_prestacao' && (
                            <button onClick={() => cancelarAprovacao(s.id)} disabled={processando === s.id}
                              style={{ ...styles.btnAcaoTexto, background: '#fef3c7', color: '#92400e' }}>
                              ↩ Cancelar aprovação
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ABA: Prestação de Contas ──────────────────────────────────────── */}
      {abaAtiva === 'prestacao' && (
        <div style={styles.tabela}>
          {emPrestacao.length === 0 ? (
            <div style={styles.vazio}>
              <p style={styles.vazioPrimario}>Nenhuma solicitação aprovada ainda</p>
              <p style={styles.vazioSecundario}>Solicitações aprovadas aparecerão aqui com prazo de 30 dias para entrega de documentos.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {emPrestacao.map((s, i) => {
                const d = s.dados || {}
                const beneficiarios = d.beneficiarios || [{ nome_completo: d.nome_completo }]
                const dias = diasRestantes(s.prazo_prestacao)
                const venceu = dias !== null && dias < 0
                const urgente = dias !== null && dias >= 0 && dias <= 5
                const cor = venceu ? '#dc2626' : urgente ? '#d97706' : '#166534'
                const bgCor = venceu ? '#fef2f2' : urgente ? '#fffbeb' : '#f0fdf4'
                const emAtraso = s.status === 'aguardando_prestacao' && venceu
                return (
                  <div key={s.id} style={{ ...styles.prestacaoCard, background: i % 2 === 0 ? '#fff' : '#f9fafb', borderLeft: `4px solid ${cor}` }}>
                    <div style={styles.prestacaoTopo}>
                      <div style={{ flex: 1 }}>
                        <p style={styles.prestacaoNome}>
                          {beneficiarios.map(b => b.nome_completo || '—').join(', ')}
                        </p>
                        <p style={styles.prestacaoInfo}>
                          {d.numero_demanda || 'Sem demanda'} · Aprovado em {fmtData(s.data_aprovacao)} · Prazo: {fmtData(s.prazo_prestacao)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ ...styles.statusBadge, background: STATUS_COR[s.status]?.bg, color: STATUS_COR[s.status]?.cor }}>
                          {STATUS_LABEL[s.status]}
                        </span>
                        {s.status === 'aguardando_prestacao' && dias !== null && (
                          <span style={{ ...styles.countdown, background: bgCor, color: cor }}>
                            {venceu
                              ? `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`
                              : dias === 0
                              ? 'Vence hoje!'
                              : `${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    {s.status === 'aguardando_prestacao' && (
                      <div style={styles.prestacaoAnexos}>
                        {/* Declaração */}
                        <div style={styles.anexoItem}>
                          {s.anexo_declaracao_url ? (
                            <a href={s.anexo_declaracao_url} target="_blank" rel="noreferrer"
                              style={styles.linkAnexo}>
                              ✅ Declaração enviada
                            </a>
                          ) : (
                            <>
                              <input
                                ref={el => declaracaoRef.current[s.id] = el}
                                type="file" accept=".pdf,.doc,.docx"
                                style={{ display: 'none' }}
                                onChange={e => e.target.files[0] && uploadAnexo(s.id, 'declaracao', e.target.files[0])}
                              />
                              <button
                                onClick={() => declaracaoRef.current[s.id]?.click()}
                                disabled={uploadando === `${s.id}-declaracao`}
                                style={styles.btnAnexo}>
                                {uploadando === `${s.id}-declaracao` ? 'Enviando...' : '📎 Anexar Declaração'}
                              </button>
                            </>
                          )}
                        </div>
                        {/* Relatório */}
                        <div style={styles.anexoItem}>
                          {s.anexo_relatorio_url ? (
                            <a href={s.anexo_relatorio_url} target="_blank" rel="noreferrer"
                              style={styles.linkAnexo}>
                              ✅ Relatório de Viagem enviado
                            </a>
                          ) : (
                            <>
                              <input
                                ref={el => relatorioRef.current[s.id] = el}
                                type="file" accept=".pdf,.doc,.docx"
                                style={{ display: 'none' }}
                                onChange={e => e.target.files[0] && uploadAnexo(s.id, 'relatorio', e.target.files[0])}
                              />
                              <button
                                onClick={() => relatorioRef.current[s.id]?.click()}
                                disabled={uploadando === `${s.id}-relatorio`}
                                style={styles.btnAnexo}>
                                {uploadando === `${s.id}-relatorio` ? 'Enviando...' : '📎 Anexar Relatório de Viagem'}
                              </button>
                            </>
                          )}
                        </div>
                        {emAtraso && (
                          <p style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600', margin: 0 }}>
                            ⚠️ Prazo vencido — entregue os documentos o quanto antes
                          </p>
                        )}
                      </div>
                    )}

                    {s.status === 'prestacao_entregue' && (
                      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.anexo_declaracao_url && (
                          <>
                            <a href={s.anexo_declaracao_url} target="_blank" rel="noreferrer" style={styles.linkAnexo}>📄 Ver Declaração</a>
                            <button onClick={() => downloadArquivo(s.anexo_declaracao_url, `declaracao-${s.id}.pdf`)} style={styles.btnDownload}>⬇️ Baixar</button>
                          </>
                        )}
                        {s.anexo_relatorio_url && (
                          <>
                            <a href={s.anexo_relatorio_url} target="_blank" rel="noreferrer" style={styles.linkAnexo}>📄 Ver Relatório</a>
                            <button onClick={() => downloadArquivo(s.anexo_relatorio_url, `relatorio-viagem-${s.id}.pdf`)} style={styles.btnDownload}>⬇️ Baixar</button>
                          </>
                        )}
                        {s.anexo_declaracao_url && s.anexo_relatorio_url && (
                          <button onClick={() => downloadZip([
                            { url: s.anexo_declaracao_url, nome: 'declaracao.pdf' },
                            { url: s.anexo_relatorio_url,  nome: 'relatorio-viagem.pdf' },
                          ], `prestacao-${s.id}`)} style={styles.btnDownloadZip}>
                            📦 Baixar tudo (.zip)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  titulo: { fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' },
  subtitulo: { fontSize: '14px', color: '#6b7280', margin: 0 },
  botaoNovo: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #1a4731, #2d7a4f)', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  abas: { display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', gap: '4px' },
  aba: { padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' },
  badge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '20px', borderRadius: '10px', background: '#dc2626', color: 'white', fontSize: '11px', fontWeight: '700', padding: '0 5px' },
  tabela: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' },
  mensagem: { padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '14px' },
  vazio: { padding: '64px', textAlign: 'center' },
  vazioPrimario: { fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' },
  vazioSecundario: { fontSize: '14px', color: '#9ca3af', margin: 0 },
  thead: { background: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  nomeTexto: { fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 2px 0' },
  emailTexto: { fontSize: '12px', color: '#6b7280', margin: 0 },
  statusBadge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' },
  btnAcao: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px 6px', borderRadius: '6px' },
  btnAcaoTexto: { padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  urgenteTag: { display: 'inline-block', fontSize: '10px', fontWeight: '700', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '10px', marginBottom: '4px' },
  prestacaoCard: { padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '10px' },
  prestacaoTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' },
  prestacaoNome: { fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' },
  prestacaoInfo: { fontSize: '12px', color: '#6b7280', margin: 0 },
  countdown: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  prestacaoAnexos: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', paddingTop: '4px' },
  anexoItem: { display: 'flex', alignItems: 'center' },
  btnAnexo: { padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  linkAnexo:     { color: '#1a4731', fontSize: '13px', fontWeight: '600', textDecoration: 'none' },
  btnDownload:   { padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#374151' },
  btnDownloadZip:{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#1a4731', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
}
